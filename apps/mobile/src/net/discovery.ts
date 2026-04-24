import { useEffect, useState } from 'react';
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

const zeroconf = new Zeroconf();

export function useDiscovery() {
  const [services, setServices] = useState<Record<string, DiscoveredService>>({});
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const onStart = () => setScanning(true);
    const onStop = () => setScanning(false);
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

    zeroconf.on('start', onStart);
    zeroconf.on('stop', onStop);
    zeroconf.on('resolved', onResolved);
    zeroconf.on('remove', onRemoved);
    zeroconf.on('error', onError);

    zeroconf.scan(BONJOUR_SERVICE_NAME, BONJOUR_PROTOCOL, BONJOUR_DOMAIN);

    return () => {
      zeroconf.stop();
      zeroconf.removeDeviceListeners();
    };
  }, []);

  return {
    services: Object.values(services),
    scanning,
    rescan: () => {
      setServices({});
      zeroconf.stop();
      zeroconf.scan(BONJOUR_SERVICE_NAME, BONJOUR_PROTOCOL, BONJOUR_DOMAIN);
    },
  };
}
