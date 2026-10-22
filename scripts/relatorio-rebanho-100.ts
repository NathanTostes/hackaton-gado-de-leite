/**
 * Relatório de assertividade do motor sobre as baterias de teste de caixa-preta.
 *
 * Uso: npm run baterias            (todas)
 *      npm run baterias clinico-50 (uma)
 */
import { assertividade, baseCompilada, baterias, executarBateria } from '@drmoo/knowledge';

const filtro = process.argv[2];
let totalOk = 0;
let total = 0;

for (const bateria of baterias) {
  if (filtro && bateria.nome !== filtro) continue;
  const resultados = executarBateria(baseCompilada, bateria);
  const falharam = resultados.filter((r) => !r.passou);

  console.log(`\n=== ${bateria.nome} (${resultados.length} prontuários) ===`);
  for (const r of falharam) {
    console.log(`✗ ${r.caso.id} — ${r.caso.descricao}`);
    console.log(`   esperado: ${r.caso.esperado.diagnosticoPrincipal}`);
    console.log(
      `   obtido:   ${r.obtido.hipoteses.map((h) => `${h.id}:${h.cf.toFixed(2)}`).join(', ') || '(nada)'}`,
    );
    console.log(`   falhas:   ${r.falhas.join(' | ')}`);
    console.log(`   regras:   ${r.obtido.regrasDisparadas.join(', ') || '(nenhuma)'}`);
  }
  console.log(
    `${resultados.length - falharam.length}/${resultados.length} corretos — ${assertividade(resultados).toFixed(1)}%`,
  );
  totalOk += resultados.length - falharam.length;
  total += resultados.length;
}

console.log(`\nTOTAL: ${totalOk}/${total} — ${((totalOk / total) * 100).toFixed(1)}%`);
