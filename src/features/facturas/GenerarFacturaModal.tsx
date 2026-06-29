import { useEffect, useState } from "react";
import { api, type Cliente, type Ticket, type Negocio } from "../../lib/api";
import { X, Download, Mail } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useDialog } from "../../context/DialogContext";
import "./GenerarFacturaModal.css";

interface GenerarFacturaModalProps {
  ticket: Ticket;
  onClose: () => void;
}

export function GenerarFacturaModal({ ticket, onClose }: GenerarFacturaModalProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const { showAlert, showConfirm } = useDialog();

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [dataClientes, dataNegocio] = await Promise.all([
          api.listarClientes(),
          api.obtenerDatosNegocio()
        ]);
        setClientes(dataClientes);
        setNegocio(dataNegocio);
      } catch (err) {
        console.error("Error al cargar datos:", err);
      } finally {
        setLoading(false);
      }
    };
    cargarDatos();
  }, []);

  const buildPDF = async () => {
    if (!clienteSeleccionado) {
      await showAlert("Por favor, selecciona un cliente para la factura.");
      return null;
    }

    const cliente = clientes.find((c) => c.id === Number(clienteSeleccionado));
    if (!cliente) return null;

    try {
      const doc = new jsPDF();
      
      // Colores de la app
      const primaryColor = [99, 102, 241]; // Indigo 500

      // Cabecera Documento
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("FACTURA", 14, 22);

      // Datos Empresa Dinámicos
      const nombreEmpresa = negocio?.nombre || "Tormel POS";
      const nifEmpresa = negocio?.nif ? `NIF: ${negocio.nif}` : "NIF: —";
      const dirEmpresa = negocio?.direccion 
        ? `${negocio.direccion}, ${negocio.codigo_postal || ""} ${negocio.ciudad || ""}` 
        : "—";

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(nombreEmpresa, 14, 30);
      doc.text(nifEmpresa, 14, 35);
      doc.text(dirEmpresa, 14, 40);

      // Datos Factura
      doc.setTextColor(0, 0, 0);
      doc.text(`Nº Ticket/Ref: ${ticket.numero || ticket.id}`, 140, 30);
      doc.text(`Fecha: ${new Date(ticket.created_at).toLocaleDateString()}`, 140, 35);

      // Datos Cliente
      doc.setFontSize(12);
      doc.text("Facturado a:", 14, 55);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(cliente.nombre, 14, 62);
      doc.setFont("helvetica", "normal");
      doc.text(`NIF/CIF: ${cliente.nif_cif || "—"}`, 14, 67);
      doc.text(`Dirección: ${cliente.direccion || "—"}, ${cliente.codigo_postal || ""} ${cliente.ciudad || ""}`, 14, 72);

      // Tabla de líneas de ticket
      const tableColumn = ["Concepto", "Cantidad", "Precio Unit.", "Total"];
      const tableRows = ticket.lineas.map(linea => [
        linea.producto_nombre,
        linea.cantidad.toString(),
        `${linea.precio_unitario.toFixed(2)} €`,
        `${linea.total.toFixed(2)} €`
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 85,
        theme: 'striped',
        headStyles: { fillColor: primaryColor as [number, number, number] },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right' },
          3: { halign: 'right' },
        }
      });

      // Totales
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "bold");
      
      const subtotal = ticket.subtotal.toFixed(2);
      const iva = ticket.total_iva.toFixed(2);
      const total = ticket.total.toFixed(2);
      
      doc.text(`Subtotal: ${subtotal} €`, 140, finalY);
      doc.text(`IVA: ${iva} €`, 140, finalY + 7);
      
      doc.setFontSize(14);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`TOTAL: ${total} €`, 140, finalY + 15);

      return { doc, cliente };
    } catch (err) {
      console.error("Error al generar PDF:", err);
      await showAlert({ title: "Error", message: "No se pudo generar el PDF.", type: "danger" });
      return null;
    }
  };

  const handleDescargarPDF = async () => {
    setGenerando(true);
    const result = await buildPDF();
    if (result) {
      const nombreArchivo = `Factura_${result.cliente.nombre.replace(/\s+/g, '_')}_${ticket.numero || ticket.id}.pdf`;
      result.doc.save(nombreArchivo);
      onClose();
    }
    setGenerando(false);
  };

  const handleEnviarEmail = async () => {
    const result = await buildPDF();
    if (!result) return;
    
    if (!result.cliente.email) {
      await showAlert({ title: "Atención", message: "Este cliente no tiene correo electrónico configurado.", type: "warning" });
      return;
    }

    const confirm = await showConfirm({
      title: "Confirmar Envío",
      message: `¿Deseas enviar la factura a ${result.cliente.email}? (Asegúrate de que el SMTP esté configurado en la BBDD).`,
    });

    if (!confirm) return;

    setEnviando(true);
    try {
      const pdfArrayBuffer = result.doc.output('arraybuffer');
      const pdfBytes = Array.from(new Uint8Array(pdfArrayBuffer));
      const nombreArchivo = `Factura_${result.cliente.nombre.replace(/\s+/g, '_')}_${ticket.numero || ticket.id}.pdf`;
      
      const subject = `Factura ${ticket.numero || ticket.id} - Tormel POS`;
      const body = `Hola ${result.cliente.nombre},\n\nAdjunto le enviamos su factura.\n\nUn saludo.`;

      await api.enviarFacturaEmail(result.cliente.email, subject, body, pdfBytes, nombreArchivo);
      
      await showAlert({ title: "Éxito", message: "La factura se ha enviado correctamente.", type: "info" });
      onClose();
    } catch (err: any) {
      console.error("Error al enviar PDF:", err);
      await showAlert({ title: "Error de envío", message: err.toString() || "No se pudo enviar el correo electrónico.", type: "danger" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <header className="modal-header">
          <h2>Emitir Factura</h2>
          <button className="btn-close-modal" onClick={onClose}><X size={20} /></button>
        </header>

        <div className="modal-body" style={{ padding: '20px 0' }}>
          <div className="factura-resumen">
            <div className="resumen-item">
              <span className="label">Ticket Ref:</span>
              <span className="value">{ticket.numero || `#${ticket.id}`}</span>
            </div>
            <div className="resumen-item">
              <span className="label">Total Ticket:</span>
              <span className="value fw-500">{ticket.total.toFixed(2)} €</span>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 20 }}>
            <label>Seleccionar Cliente Destinatario</label>
            {loading ? (
              <div className="input text-muted">Cargando clientes...</div>
            ) : (
              <select 
                className="input" 
                value={clienteSeleccionado} 
                onChange={(e) => setClienteSeleccionado(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">-- Elige un cliente --</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} {c.nif_cif ? `(${c.nif_cif})` : ""}</option>
                ))}
              </select>
            )}
          </div>
          
          {clientes.length === 0 && !loading && (
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: 8 }}>
              No hay clientes registrados. Por favor, da de alta un cliente en el panel de "Clientes" primero.
            </p>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={generando || enviando}>Cancelar</button>
          
          <button 
            className="btn btn-secondary" 
            onClick={handleEnviarEmail}
            disabled={!clienteSeleccionado || generando || enviando}
          >
            {enviando ? (
              "Enviando..."
            ) : (
              <>
                <Mail size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Enviar por Email
              </>
            )}
          </button>

          <button 
            className="btn btn-primary" 
            onClick={handleDescargarPDF}
            disabled={!clienteSeleccionado || generando || enviando}
          >
            {generando ? (
              "Generando..."
            ) : (
              <>
                <Download size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Descargar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
