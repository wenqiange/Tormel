import { useState, useEffect } from "react";
import { X, Delete } from "lucide-react";
import "./TecladoNumericoModal.css";

interface TecladoNumericoModalProps {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  onClose: () => void;
  onAccept: (val: string) => void;
}

export function TecladoNumericoModal({
  title,
  message,
  defaultValue = "",
  placeholder = "0.00",
  onClose,
  onAccept,
}: TecladoNumericoModalProps) {
  const [value, setValue] = useState(() => {
    // Convertir de formato interno (punto) a formato visual (coma)
    return defaultValue.replace(".", ",");
  });

  const handleKeyClick = (key: string) => {
    if (key === "⌫") {
      setValue((prev) => prev.slice(0, -1));
    } else if (key === "C") {
      setValue("");
    } else if (key === ",") {
      if (!value.includes(",")) {
        setValue((prev) => (prev === "" ? "0," : prev + ","));
      }
    } else {
      // Validar máximo 2 decimales
      const parts = value.split(",");
      if (parts[1] && parts[1].length >= 2) return;
      setValue((prev) => prev + key);
    }
  };

  const handleConfirm = () => {
    // Si está vacío, tratarlo como 0 o devolver vacío
    const normalized = value.replace(",", ".") || "0";
    onAccept(normalized);
  };

  // Soporte de teclado físico
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleKeyClick(e.key);
      } else if (e.key === "," || e.key === ".") {
        handleKeyClick(",");
      } else if (e.key === "Backspace") {
        handleKeyClick("⌫");
      } else if (e.key === "Enter") {
        handleConfirm();
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [value]);

  return (
    <div className="numpad-modal-overlay animate-fadeIn">
      <div className="numpad-modal-card animate-slideUp">
        <header className="numpad-modal-header">
          <h3>{title}</h3>
          <button className="numpad-modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="numpad-modal-body">
          {message && <p className="numpad-modal-msg">{message}</p>}

          <div className="numpad-display-container">
            <input
              type="text"
              className="numpad-display-input"
              value={value}
              placeholder={placeholder.replace(".", ",")}
              readOnly
            />
            <span className="numpad-currency-symbol">€</span>
          </div>

          <div className="numpad-grid">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
              <button
                key={key}
                className="numpad-btn"
                onClick={() => handleKeyClick(key)}
              >
                {key}
              </button>
            ))}
            <button className="numpad-btn numpad-btn-clear" onClick={() => handleKeyClick("C")}>
              C
            </button>
            <button className="numpad-btn" onClick={() => handleKeyClick("0")}>
              0
            </button>
            <button className="numpad-btn numpad-btn-delete" onClick={() => handleKeyClick("⌫")}>
              <Delete size={22} />
            </button>
          </div>
        </div>

        <footer className="numpad-modal-footer">
          <button className="btn btn-secondary btn-lg" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary btn-lg" onClick={handleConfirm}>
            Aceptar
          </button>
        </footer>
      </div>
    </div>
  );
}
