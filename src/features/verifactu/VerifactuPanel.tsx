import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./VerifactuPanel.css";
import { ConfigVerifactuModal } from "./ConfigVerifactuModal";

interface VentaCompleta {
  id: number;
  numero: string | null;
  total: number;
  abierta_at: string;
  hash_registro: string | null;
  estado_verifactu: string | null;
  tipo: string;
}

export function VerifactuPanel() {
  const [activeTab, setActiveTab] = useState<"declaracion" | "consulta">("declaracion");
  const [ventas, setVentas] = useState<VentaCompleta[]>([]);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (activeTab === "consulta") {
      cargarVentas();
    }
  }, [activeTab]);

  const cargarVentas = async () => {
    try {
      // Usamos el comando existente que trae ventas con su hash
      const data = await invoke<VentaCompleta[]>("obtener_ventas_diarias");
      setVentas(data);
    } catch (err) {
      console.error("Error al cargar ventas para AEAT:", err);
    }
  };

  const formatearFecha = (fechaStr: string) => {
    if (!fechaStr) return "-";
    const partes = fechaStr.split("T");
    if (partes.length === 2) {
      const fecha = partes[0].split("-").reverse().join("/");
      const hora = partes[1].substring(0, 8);
      return `${fecha} ${hora}`;
    }
    return fechaStr;
  };

  return (
    <div className="verifactu-panel animate-fadeIn">
      <div className="verifactu-tabs">
        <button
          className={`verifactu-tab ${activeTab === "declaracion" ? "active" : ""}`}
          onClick={() => setActiveTab("declaracion")}
        >
          Declaración Responsable
        </button>
        <button
          className={`verifactu-tab ${activeTab === "consulta" ? "active" : ""}`}
          onClick={() => setActiveTab("consulta")}
        >
          Consulta Registros AEAT
        </button>
        <button
          className="btn btn-secondary"
          style={{ marginLeft: "auto" }}
          onClick={() => setShowConfig(true)}
        >
          ⚙️ Configurar Certificado
        </button>
      </div>

      <div className="verifactu-content">
        {activeTab === "declaracion" && (
          <div className="declaracion-card">
            <div className="declaracion-header">
              <h2>Declaración Responsable del Fabricante</h2>
              <p>Sistemas Informáticos de Facturación (Ley 11/2021 y RD 1007/2023)</p>
            </div>
            
            <div className="declaracion-body">
              <p>
                De acuerdo con lo establecido en el Artículo 29.2.j) de la Ley 58/2003, de 17 de diciembre, 
                General Tributaria y el <strong>Real Decreto 1007/2023, de 5 de diciembre</strong>, por el que se aprueba 
                el Reglamento que establece los requisitos que deben adoptar los sistemas y programas informáticos o electrónicos 
                que soporten los procesos de facturación de empresarios y profesionales.
              </p>
              
              <p>
                El productor/fabricante del presente software, declara bajo su exclusiva responsabilidad que este Sistema Informático 
                de Facturación <strong>cumple estrictamente con todos los requisitos técnicos y legales vigentes</strong> en materia de 
                inalterabilidad, trazabilidad, conservación y envío de los registros de facturación (VERI*FACTU).
              </p>

              <div className="declaracion-info-grid">
                <div className="info-item">
                  <strong>Nombre del Software</strong>
                  <span>Tormel POS</span>
                </div>
                <div className="info-item">
                  <strong>ID Sistema Informático</strong>
                  <span>01</span>
                </div>
                <div className="info-item">
                  <strong>Versión</strong>
                  <span>0.1.0</span>
                </div>
                <div className="info-item">
                  <strong>Número de Instalación</strong>
                  <span>1</span>
                </div>
                <div className="info-item">
                  <strong>Productor / Desarrollador</strong>
                  <span>Empresa Desarrolladora Ficticia S.L.</span>
                </div>
                <div className="info-item">
                  <strong>NIF Productor</strong>
                  <span>B12345678</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "consulta" && (
          <div className="aeat-table-container">
            <table className="aeat-table">
              <thead>
                <tr>
                  <th>Nº Factura</th>
                  <th>Fecha/Hora</th>
                  <th>Importe</th>
                  <th>Estado SIF</th>
                  <th>Huella / Hash Registro</th>
                </tr>
              </thead>
              <tbody>
                {ventas.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "2rem" }}>
                      No hay registros de facturación generados hoy.
                    </td>
                  </tr>
                ) : (
                  ventas.map((v) => (
                    <tr key={v.id}>
                      <td>{v.numero || "SINFAC"}</td>
                      <td>{formatearFecha(v.abierta_at)}</td>
                      <td>{v.total.toFixed(2)} €</td>
                      <td>
                        <span className={`badge ${v.estado_verifactu === 'enviado' ? 'badge-success' : 'badge-warning'}`}>
                          {v.estado_verifactu || "pendiente"}
                        </span>
                      </td>
                      <td className="hash-cell">
                        {v.hash_registro || "Pendiente de generación..."}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showConfig && (
        <ConfigVerifactuModal onClose={() => setShowConfig(false)} />
      )}
    </div>
  );
}
