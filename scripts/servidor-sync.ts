#!/usr/bin/env node
/**
 * Ponto de entrada do servidor de sincronização da propriedade.
 *
 *   npm run sync
 *
 * A lógica mora em `packages/sync/src/servidor.ts`, importável pela suíte sem
 * ocupar porta nenhuma. Aqui só se liga o processo.
 */
import { iniciar } from '../packages/sync/src/servidor';

iniciar();
