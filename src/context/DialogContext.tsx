import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { AlertCircle, HelpCircle, Info } from 'lucide-react';
import './Dialogs.css';

interface DialogOptions {
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'danger';
}

interface PromptOptions extends DialogOptions {
  defaultValue?: string;
  placeholder?: string;
}

interface DialogContextType {
  showAlert: (options: DialogOptions | string) => Promise<void>;
  showConfirm: (options: DialogOptions | string) => Promise<boolean>;
  showPrompt: (options: PromptOptions | string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'prompt';
    options: PromptOptions;
    resolve: (value: any) => void;
    inputValue: string;
  } | null>(null);

  const showAlert = useCallback(async (options: DialogOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : options;
      setDialogState({
        isOpen: true,
        type: 'alert',
        options: opts,
        resolve,
        inputValue: '',
      });
    });
  }, []);

  const showConfirm = useCallback(async (options: DialogOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : options;
      setDialogState({
        isOpen: true,
        type: 'confirm',
        options: opts,
        resolve,
        inputValue: '',
      });
    });
  }, []);

  const showPrompt = useCallback(async (options: PromptOptions | string): Promise<string | null> => {
    return new Promise((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : options;
      setDialogState({
        isOpen: true,
        type: 'prompt',
        options: opts,
        resolve,
        inputValue: opts.defaultValue || '',
      });
    });
  }, []);

  const handleClose = (value: any) => {
    if (dialogState) {
      dialogState.resolve(value);
      setDialogState(null);
    }
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'warning': return <AlertCircle size={32} style={{ color: 'var(--color-warning)' }} />;
      case 'danger': return <AlertCircle size={32} style={{ color: 'var(--color-danger)' }} />;
      default: return <Info size={32} style={{ color: 'var(--color-accent)' }} />;
    }
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}
      
      {dialogState && dialogState.isOpen && (
        <div className="custom-dialog-overlay animate-fadeIn">
          <div className="custom-dialog-card animate-slideUp">
            <div className="custom-dialog-header">
              <div className="custom-dialog-icon">
                {dialogState.type === 'confirm' ? <HelpCircle size={32} style={{ color: 'var(--color-warning)' }} /> : getIcon(dialogState.options.type)}
              </div>
              <h3>{dialogState.options.title || (dialogState.type === 'alert' ? 'Aviso' : dialogState.type === 'confirm' ? 'Confirmación' : 'Entrada requerida')}</h3>
            </div>
            
            <div className="custom-dialog-body">
              <p>{dialogState.options.message}</p>
              
              {dialogState.type === 'prompt' && (
                <input
                  type="text"
                  className="input custom-dialog-input"
                  value={dialogState.inputValue}
                  onChange={(e) => setDialogState({ ...dialogState, inputValue: e.target.value })}
                  placeholder={dialogState.options.placeholder}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleClose(dialogState.inputValue);
                    if (e.key === 'Escape') handleClose(null);
                  }}
                />
              )}
            </div>

            <div className="custom-dialog-footer">
              {dialogState.type !== 'alert' && (
                <button 
                  className="btn btn-secondary" 
                  onClick={() => handleClose(dialogState.type === 'confirm' ? false : null)}
                >
                  Cancelar
                </button>
              )}
              <button 
                className={`btn ${dialogState.options.type === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
                onClick={() => handleClose(dialogState.type === 'prompt' ? dialogState.inputValue : true)}
                autoFocus={dialogState.type !== 'prompt'}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};
