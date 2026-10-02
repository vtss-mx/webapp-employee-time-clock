import { LogOut, Smartphone, TabletSmartphone } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { PhoneAccessGuide } from '../components/PhoneAccessGuide';
import { useAuth } from '../hooks/useAuth';
import { useFeedback } from '../hooks/useFeedback';

const DEVICE_LABEL = { desktop: 'Estás usando una computadora', tablet: 'Estás usando una tableta' } as const;

/**
 * Si el servidor rechaza el dispositivo (empleado en computadora o tableta; validador en
 * computadora), se muestra el popup "continúa desde tu teléfono" (o "desde una tableta o un
 * teléfono"). La decisión es del backend (política de la empresa).
 */
export function DeviceGate({ children }: { children: ReactNode }) {
  const { deviceBlock, dismissDeviceBlock, isAuthenticated } = useAuth();
  const feedback = useFeedback();

  useEffect(() => {
    if (!deviceBlock) return;
    const touch = deviceBlock.requires === 'touch';
    void feedback
      .show({
        variant: 'info',
        icon: touch ? <TabletSmartphone size={30} /> : <Smartphone size={30} />,
        eyebrow: DEVICE_LABEL[deviceBlock.device],
        title: touch ? 'Continúa desde una tableta o un teléfono' : 'Continúa desde tu teléfono celular',
        text: deviceBlock.message,
        body: <PhoneAccessGuide device={touch ? 'touch' : 'phone'} />,
        footnote: '¿Necesitas ayuda? Comunícate con Recursos Humanos o con el administrador del sistema.',
        actions: [{ id: 'exit', label: isAuthenticated ? 'Cerrar sesión' : 'Entendido', icon: <LogOut size={18} /> }],
        dismissible: false,
        wide: true,
        key: 'device-block',
      })
      .then(() => dismissDeviceBlock());
  }, [deviceBlock, isAuthenticated, feedback, dismissDeviceBlock]);

  // Con la sesión abierta no se muestra la app detrás: todas sus peticiones serían rechazadas.
  if (deviceBlock && isAuthenticated) return <div className="device-gate" aria-hidden />;
  return <>{children}</>;
}
