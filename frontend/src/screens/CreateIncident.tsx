import { IncidentForm } from './IncidentForm';

export function CreateIncident({
  onPublished,
  onCancel,
}: {
  onPublished: (id: string) => void;
  onCancel: () => void;
}) {
  return <IncidentForm onSaved={onPublished} onCancel={onCancel} />;
}
