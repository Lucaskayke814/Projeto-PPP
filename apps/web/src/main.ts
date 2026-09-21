import { assertPublicSupabaseConfig } from './config/environment';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Elemento de aplicação não encontrado.');

try {
  assertPublicSupabaseConfig();
  root.hidden = true;
} catch (error) {
  console.error(error);
  root.hidden = true;
}
