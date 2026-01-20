declare module 'escpos' {
  export class Printer {
    constructor(device: any, options?: { encoding?: string });
    font(family: 'a' | 'b' | 'c'): this;
    align(alignment: 'lt' | 'ct' | 'rt'): this;
    style(type: 'b' | 'i' | 'u' | 'u2' | 'bi' | 'biu' | 'biu2' | 'bu' | 'bu2' | 'iu' | 'iu2' | 'normal'): this;
    size(width: number, height: number): this;
    text(content: string): this;
    feed(n?: number): this;
    cut(partial?: boolean): this;
    close(callback?: () => void): this;
  }

  export let USB: any;
  export let Network: any;
  export let Serial: any;

  const escpos: {
    Printer: typeof Printer;
    USB: any;
    Network: any;
    Serial: any;
  };
  export default escpos;
}

declare module 'escpos-usb' {
  export default class USB {
    constructor(vendorId?: number, productId?: number);
    open(callback: (error: Error | null) => void): void;
    close(callback?: () => void): void;
  }
}

declare module 'escpos-network' {
  export default class Network {
    constructor(address: string, port?: number);
    open(callback: (error: Error | null) => void): void;
    close(callback?: () => void): void;
  }
}
