import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PrintingService, PrinterConfig } from './printing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('printing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrintingController {
  constructor(private readonly printingService: PrintingService) {}

  @Get('printers')
  @Roles('ADMIN', 'MANAGER')
  getAvailablePrinters(): { id: string; config: PrinterConfig }[] {
    return this.printingService.getAvailablePrinters();
  }

  @Post('test/:printerId')
  @Roles('ADMIN', 'MANAGER')
  async testPrinter(@Param('printerId') printerId: string): Promise<{ success: boolean }> {
    const success = await this.printingService.testPrinter(printerId);
    return { success };
  }

  @Post('kitchen')
  async printKitchen(@Body() data: any): Promise<{ success: boolean }> {
    const success = await this.printingService.printKitchenTicket(data);
    return { success };
  }

  @Post('receipt')
  async printReceipt(@Body() data: any): Promise<{ success: boolean }> {
    const success = await this.printingService.printReceipt(data);
    return { success };
  }

  @Post('report')
  @Roles('ADMIN', 'MANAGER')
  async printReport(@Body() data: any): Promise<{ success: boolean }> {
    const success = await this.printingService.printDailyReport(data);
    return { success };
  }

  @Post('register')
  @Roles('ADMIN')
  registerPrinter(
    @Body() body: { id: string; config: PrinterConfig },
  ): { message: string } {
    this.printingService.registerPrinter(body.id, body.config);
    return { message: `Printer ${body.id} registered successfully` };
  }
}
