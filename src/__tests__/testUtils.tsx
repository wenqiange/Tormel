import { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { DialogProvider } from "../context/DialogContext";

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(<DialogProvider>{ui}</DialogProvider>, options);
}
