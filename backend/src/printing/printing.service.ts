import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as escpos from 'escpos';

// ESC/POS adapters
let USB: any = null;
let Network: any = null;

// ESC/POS USB adapter
try {
  USB = require('escpos-usb');
} catch (e) {
  // USB not available
}

// ESC/POS Network adapter
try {
  Network = require('escpos-network');
} catch (e) {
  // Network not available
}

export interface PrinterConfig {
  type: 'usb' | 'network' | 'serial';
  name: string;
  vendorId?: number;
  productId?: number;
  ip?: string;
  port?: number;
  serialPath?: string;
  baudRate?: number;
  paperWidth?: 58 | 80;
  encoding?: string;
}

export interface PrintJob {
  type: 'kitchen' | 'receipt' | 'bill' | 'report';
  data: any;
  printer?: string;
  copies?: number;
}

@Injectable()
export class PrintingService implements OnModuleInit {
  private readonly logger = new Logger(PrintingService.name);
  private printers: Map<string, any> = new Map();
  private printerConfigs: Map<string, PrinterConfig> = new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializePrinters();
  }

  private async initializePrinters() {
    // Load printer configurations from environment or database
    const kitchenPrinterIp = this.configService.get<string>('KITCHEN_PRINTER_IP');
    const receiptPrinterIp = this.configService.get<string>('RECEIPT_PRINTER_IP');

    if (kitchenPrinterIp) {
      this.registerPrinter('kitchen', {
        type: 'network',
        name: 'Kitchen Printer',
        ip: kitchenPrinterIp,
        port: parseInt(this.configService.get<string>('KITCHEN_PRINTER_PORT') || '9100'),
        paperWidth: 80,
        encoding: 'UTF-8',
      });
    }

    if (receiptPrinterIp) {
      this.registerPrinter('receipt', {
        type: 'network',
        name: 'Receipt Printer',
        ip: receiptPrinterIp,
        port: parseInt(this.configService.get<string>('RECEIPT_PRINTER_PORT') || '9100'),
        paperWidth: 80,
        encoding: 'UTF-8',
      });
    }
  }

  registerPrinter(id: string, config: PrinterConfig) {
    this.printerConfigs.set(id, config);
    this.logger.log(`Registered printer: ${id} (${config.name})`);
  }

  private async getDevice(printerId: string): Promise<any> {
    const config = this.printerConfigs.get(printerId);
    if (!config) {
      throw new Error(`Printer not found: ${printerId}`);
    }

    switch (config.type) {
      case 'network':
        if (!Network) {
          throw new Error('Network printing not available. Install escpos-network package.');
        }
        return new Network(config.ip, config.port);
      
      case 'usb':
        if (!USB) {
          throw new Error('USB printing not available. Install escpos-usb package.');
        }
        return new USB(config.vendorId, config.productId);
      
      default:
        throw new Error(`Unsupported printer type: ${config.type}`);
    }
  }

  async print(job: PrintJob): Promise<boolean> {
    const printerId = job.printer || this.getDefaultPrinter(job.type);
    const copies = job.copies || 1;

    try {
      for (let i = 0; i < copies; i++) {
        await this.executePrint(printerId, job);
      }
      return true;
    } catch (error) {
      this.logger.error(`Print failed for ${printerId}: ${error.message}`);
      return false;
    }
  }

  private getDefaultPrinter(type: string): string {
    switch (type) {
      case 'kitchen':
        return 'kitchen';
      case 'receipt':
      case 'bill':
      case 'report':
      default:
        return 'receipt';
    }
  }

  private async executePrint(printerId: string, job: PrintJob): Promise<void> {
    const config = this.printerConfigs.get(printerId);
    if (!config) {
      this.logger.warn(`Printer ${printerId} not configured, skipping print`);
      return;
    }

    const device = await this.getDevice(printerId);
    const printer = new escpos.Printer(device, { encoding: config.encoding || 'UTF-8' });

    return new Promise((resolve, reject) => {
      device.open((error: Error) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          switch (job.type) {
            case 'kitchen':
              this.printKitchenOrder(printer, job.data, config);
              break;
            case 'receipt':
            case 'bill':
              this.printBill(printer, job.data, config);
              break;
            case 'report':
              this.printReport(printer, job.data, config);
              break;
          }

          printer.cut().close(() => {
            resolve();
          });
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private printKitchenOrder(printer: any, order: any, config: PrinterConfig) {
    const width = config.paperWidth === 58 ? 32 : 48;
    const separator = '-'.repeat(width);

    printer
      .font('a')
      .align('ct')
      .style('b')
      .size(1, 1)
      .text('*** COCINA ***')
      .size(0, 0)
      .text(separator)
      .align('lt')
      .text(`Mesa: ${order.tableName || 'N/A'}`)
      .text(`Orden: #${order.orderNumber || order.id?.slice(-6)}`)
      .text(`Hora: ${new Date().toLocaleTimeString('es-ES')}`)
      .text(`Mesero: ${order.waiterName || 'N/A'}`)
      .text(separator);

    // Print items
    for (const item of order.items || []) {
      if (!item.product?.sendToKitchen) continue;

      printer
        .style('b')
        .text(`${item.quantity}x ${item.product?.name || item.name}`)
        .style('normal');

      // Print modifiers
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          printer.text(`   + ${mod.name}`);
        }
      }

      // Print notes
      if (item.notes) {
        printer.text(`   NOTA: ${item.notes}`);
      }
    }

    printer
      .text(separator)
      .align('ct')
      .style('b')
      .text(new Date().toLocaleDateString('es-ES'))
      .style('normal')
      .feed(3);
  }

  private printBill(printer: any, bill: any, config: PrinterConfig) {
    const width = config.paperWidth === 58 ? 32 : 48;
    const separator = '-'.repeat(width);

    // Header
    printer
      .font('a')
      .align('ct')
      .style('b')
      .size(1, 1)
      .text(bill.restaurantName || 'TORMEL POS')
      .size(0, 0)
      .style('normal')
      .text(bill.restaurantAddress || '')
      .text(bill.restaurantPhone || '')
      .text(bill.restaurantNif || '')
      .text(separator);

    // Bill info
    printer
      .align('lt')
      .text(`Factura: ${bill.billNumber || bill.id?.slice(-8)}`)
      .text(`Fecha: ${new Date(bill.createdAt).toLocaleString('es-ES')}`)
      .text(`Mesa: ${bill.tableName || 'N/A'}`)
      .text(`Atendido por: ${bill.waiterName || 'N/A'}`)
      .text(separator);

    // Items
    printer.style('b').text('CONCEPTO             CANT   PRECIO');
    printer.style('normal').text(separator);

    for (const item of bill.items || []) {
      const name = (item.productName || item.name || '').substring(0, 20).padEnd(20);
      const qty = String(item.quantity || 1).padStart(4);
      const price = this.formatCurrency(item.totalPrice || item.price || 0).padStart(8);
      
      printer.text(`${name}${qty}${price}`);

      // Print modifiers with price
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          const modName = `  + ${mod.name}`.substring(0, 20).padEnd(24);
          const modPrice = this.formatCurrency(mod.price || 0).padStart(8);
          printer.text(`${modName}${modPrice}`);
        }
      }
    }

    printer.text(separator);

    // Totals
    const subtotalLabel = 'Subtotal:'.padEnd(width - 10);
    const subtotalValue = this.formatCurrency(bill.subtotal || 0).padStart(10);
    printer.text(`${subtotalLabel}${subtotalValue}`);

    if (bill.discount && bill.discount > 0) {
      const discountLabel = `Descuento${bill.discountType === 'PERCENTAGE' ? ` (${bill.discountValue}%)` : ''}:`.padEnd(width - 10);
      const discountValue = `-${this.formatCurrency(bill.discount)}`.padStart(10);
      printer.text(`${discountLabel}${discountValue}`);
    }

    const taxLabel = `IVA (${bill.taxRate || 21}%):`.padEnd(width - 10);
    const taxValue = this.formatCurrency(bill.tax || 0).padStart(10);
    printer.text(`${taxLabel}${taxValue}`);

    if (bill.tip && bill.tip > 0) {
      const tipLabel = 'Propina:'.padEnd(width - 10);
      const tipValue = this.formatCurrency(bill.tip).padStart(10);
      printer.text(`${tipLabel}${tipValue}`);
    }

    printer.text(separator);
    
    const totalLabel = 'TOTAL:'.padEnd(width - 10);
    const totalValue = this.formatCurrency(bill.total || 0).padStart(10);
    printer.style('b').size(1, 1).text(`${totalLabel}${totalValue}`).size(0, 0).style('normal');

    printer.text(separator);

    // Payment info
    if (bill.payments && bill.payments.length > 0) {
      printer.text('PAGOS:');
      for (const payment of bill.payments) {
        const method = this.translatePaymentMethod(payment.method);
        const amount = this.formatCurrency(payment.amount);
        printer.text(`  ${method}: ${amount}`);
        
        if (payment.method === 'CASH' && payment.change > 0) {
          printer.text(`  Cambio: ${this.formatCurrency(payment.change)}`);
        }
      }
      printer.text(separator);
    }

    // Footer
    printer
      .align('ct')
      .text('¡Gracias por su visita!')
      .text('Vuelva pronto')
      .feed(2)
      .text(new Date().toLocaleString('es-ES'))
      .feed(4);
  }

  private printReport(printer: any, report: any, config: PrinterConfig) {
    const width = config.paperWidth === 58 ? 32 : 48;
    const separator = '='.repeat(width);

    printer
      .font('a')
      .align('ct')
      .style('b')
      .size(1, 1)
      .text('INFORME DE CIERRE')
      .size(0, 0)
      .text(separator)
      .align('lt')
      .text(`Fecha: ${report.date || new Date().toLocaleDateString('es-ES')}`)
      .text(`Usuario: ${report.userName || 'N/A'}`)
      .text(separator);

    // Sales summary
    printer.style('b').text('RESUMEN DE VENTAS');
    printer.style('normal');
    
    this.printReportLine(printer, 'Total facturas:', report.totalBills || 0, width);
    this.printReportLine(printer, 'Subtotal:', this.formatCurrency(report.subtotal || 0), width);
    this.printReportLine(printer, 'Descuentos:', this.formatCurrency(report.totalDiscounts || 0), width);
    this.printReportLine(printer, 'IVA:', this.formatCurrency(report.totalTax || 0), width);
    this.printReportLine(printer, 'Propinas:', this.formatCurrency(report.totalTips || 0), width);
    
    printer.text(separator);
    printer.style('b');
    this.printReportLine(printer, 'TOTAL:', this.formatCurrency(report.totalSales || 0), width);
    printer.style('normal');

    // Payment methods breakdown
    if (report.paymentBreakdown) {
      printer.text(separator);
      printer.style('b').text('DESGLOSE POR MÉTODO');
      printer.style('normal');
      
      for (const [method, amount] of Object.entries(report.paymentBreakdown)) {
        this.printReportLine(printer, this.translatePaymentMethod(method) + ':', this.formatCurrency(amount as number), width);
      }
    }

    printer
      .text(separator)
      .align('ct')
      .text('*** FIN DEL INFORME ***')
      .feed(4);
  }

  private printReportLine(printer: any, label: string, value: any, width: number) {
    const valueStr = String(value);
    const labelPadded = label.padEnd(width - valueStr.length);
    printer.text(`${labelPadded}${valueStr}`);
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  private translatePaymentMethod(method: string): string {
    const translations: Record<string, string> = {
      CASH: 'Efectivo',
      CARD: 'Tarjeta',
      TRANSFER: 'Transferencia',
      VOUCHER: 'Vale',
    };
    return translations[method] || method;
  }

  // Public methods for other services
  async printKitchenTicket(order: any): Promise<boolean> {
    return this.print({
      type: 'kitchen',
      data: order,
    });
  }

  async printReceipt(bill: any): Promise<boolean> {
    return this.print({
      type: 'bill',
      data: bill,
    });
  }

  async printDailyReport(report: any): Promise<boolean> {
    return this.print({
      type: 'report',
      data: report,
    });
  }

  // Get available printers
  getAvailablePrinters(): { id: string; config: PrinterConfig }[] {
    const printers: { id: string; config: PrinterConfig }[] = [];
    this.printerConfigs.forEach((config, id) => {
      printers.push({ id, config });
    });
    return printers;
  }

  // Test printer connection
  async testPrinter(printerId: string): Promise<boolean> {
    try {
      const device = await this.getDevice(printerId);
      const printer = new escpos.Printer(device);

      return new Promise((resolve) => {
        device.open((error: Error) => {
          if (error) {
            this.logger.error(`Test print failed for ${printerId}: ${error.message}`);
            resolve(false);
            return;
          }

          printer
            .font('a')
            .align('ct')
            .text('*** TEST DE IMPRESORA ***')
            .text(`Fecha: ${new Date().toLocaleString('es-ES')}`)
            .text('Impresora funcionando correctamente')
            .feed(4)
            .cut()
            .close(() => {
              this.logger.log(`Test print successful for ${printerId}`);
              resolve(true);
            });
        });
      });
    } catch (error) {
      this.logger.error(`Test print failed for ${printerId}: ${error.message}`);
      return false;
    }
  }
}
