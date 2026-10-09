import { useI18n } from './I18nProvider';
import type {Message} from './types';
export function AnswerStatus({message}: {message:Message}) {
  const {t}=useI18n();
  if (message.status !== 'streaming') return null;
  return <span className="sr-only" role="status">{t(message.text?'Generating answer':'Waiting for model')}</span>;
}
