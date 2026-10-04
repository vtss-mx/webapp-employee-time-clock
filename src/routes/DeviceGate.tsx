import { LogOut, TabletSmartphone } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { PhoneAccessGuide } from '../components/PhoneAccessGuide';
import { useAuth } from '../hooks/useAuth';
import { useFeedback } from '../hooks/useFeedback';

/**
 * Si el servidor rechaza el dispositivo (un validador en una computadora: su empresa exige tableta o
 * teléfono), se muestra el popup "continúa desde una tableta o un teléfono". Es la única restricción
 * de dispositivo de la aplicación y la decide el backend (política de la empresa).
 */
export function DeviceGate({ children }: { children: ReactNode }) {
  const { deviceBlock, dismissDeviceBlock, isAuthenticated } = useAuth();
  const feedback = useFeedback();

  useEffect(() => {
    if (!deviceBlock) return;
    void feedback
      .show({
        variant: 'info',
        icon: <TabletSmartphone size={30} />,
        eyebrow: 'Estás usando una computadora',
        title: 'Continúa desde una tableta o un teléfono',
        text: deviceBlock.message,
        body: <PhoneAccessGuide />,
        footnote: '¿Necesitas ayuda? Comunícate con el administrador de tu empresa.',
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
