import { useCallback, useEffect, useRef, useState } from 'react';
import Zeroconf from 'react-native-zeroconf';

import { BONJOUR_DOMAIN, BONJOUR_PROTOCOL, BONJOUR_SERVICE_NAME } from '@entangle/protocol';

export interface DiscoveredService {
  name: string;
  host: string;
  port: number;
  fullName?: string;
}

type ZeroconfService = {
  name: string;
  host?: string;
  port?: number;
  fullName?: string;
  addresses?: string[];
};

const SCANNING_INDICATOR_MS = 5000;

export function useDiscovery() {
  const [services, setServices] = useState<Record<string, DiscoveredService>>({});
  const [scanning, setScanning] = useState(false);
  const zeroconfRef = useRef<Zeroconf | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startScanIndicator = useCallback(() => {
    setScanning(true);
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    scanTimerRef.current = setTimeout(() => {
      setScanning(false);
      scanTimerRef.current = null;
    }, SCANNING_INDICATOR_MS);
  }, []);

  useEffect(() => {
    const zeroconf = new Zeroconf();
    zeroconfRef.current = zeroconf;

    const onResolved = (service: ZeroconfService) => {
      const host = service.addresses?.[0] ?? service.host;
      if (!host || !service.port) return;
      setServices((prev) => ({
        ...prev,
        [service.name]: {
          name: service.name,
          host,
          port: service.port!,
          fullName: service.fullName,
        },
      }));
    };
    const onRemoved = (name: string) => {
      setServices((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    };
    const onError = (error: unknown) => {
      // eslint-disable-next-line no-console
      console.warn('[zeroconf]', error);
    };

    zeroconf.on('resolved', onResolved);
    zeroconf.on('remove', onRemoved);
    zeroconf.on('error', onError);

    zeroconf.scan(BONJOUR_SERVICE_NAME, BONJOUR_PROTOCOL, BONJOUR_DOMAIN);
    startScanIndicator();

    return () => {
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
      zeroconf.stop();
      zeroconf.removeDeviceListeners();
      zeroconfRef.current = null;
    };
  }, [startScanIndicator]);

  const rescan = useCallback(() => {
    const zeroconf = zeroconfRef.current;
    if (!zeroconf) return;
    setServices({});
    zeroconf.stop();
    zeroconf.scan(BONJOUR_SERVICE_NAME, BONJOUR_PROTOCOL, BONJOUR_DOMAIN);
    startScanIndicator();
  }, [startScanIndicator]);

  return {
    services: Object.values(services),
    scanning,
    rescan,
  };
}
