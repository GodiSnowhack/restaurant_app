declare module 'react-qr-scanner' {
  import { Component } from 'react';

  export interface QrReaderProps {
    delay?: number;
    onError: (error: any) => void;
    onScan: (data: { text: string } | null) => void;
    constraints?: MediaTrackConstraints | any;
    style?: React.CSSProperties;
    className?: string;
    facingMode?: string;
    legacyMode?: boolean;
    maxImageSize?: number;
    chooseDeviceId?: string;
  }

  export default class QrReader extends Component<QrReaderProps> {}
} 