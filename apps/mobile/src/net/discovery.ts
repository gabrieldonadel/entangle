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

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Pick a host we can actually dial.
 *
 * `NSNetService.addresses` mixes IPv4 and IPv6 and the order is not stable
 * between resolves, so `addresses[0]` is often an IPv6 address. Two of those
 * forms are unusable here: a link-local address (`fe80::…`) is meaningless
 * without a scope id, and a bare IPv6 literal has to be bracketed before it
 * can go into a URL. The `.local.` hostname is the last resort — a WebSocket
 * to an unresolvable one never fires `onerror` or `onclose`, so it hangs the
 * connection state machine forever.
 */
export function pickHost(service: ZeroconfService): string | undefined {
  const addresses = service.addresses ?? [];
  const ipv4 = addresses.find((address) => IPV4.test(address));
  if (ipv4) return ipv4;
  const ipv6 = addresses.find(
    (address) => address.includes(':') && !address.toLowerCase().startsWith('fe80'),
  );
  if (ipv6) return `[${ipv6}]`;
  return service.host;
}

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
      const host = pickHost(service);
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
