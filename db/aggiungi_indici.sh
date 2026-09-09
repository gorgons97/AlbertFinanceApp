#!/usr/bin/env bash
# =============================================================================
#  Albert — ottimizzazione indici tabella `transazioni`
#
#  SCOPO
#  Il saldo di un portafoglio viene ricalcolato sommando le transazioni di quel
#  portafoglio (services/saldi.py). Senza un indice su id_portafoglio Postgres
#  fa uno SCAN SEQUENZIALE dell'intera tabella a ogni ricalcolo: più cresce il
#  DB, più ogni spesa/guadagno/trasferimento diventa lento.
#
#  Questo script crea gli indici mancanti in modo IDEMPOTENTE (sicuro da
#  rilanciare più volte: non dà errore se esistono già).
#
#  USO — due modalità:
#
#  1) DA UNA SHELL SUL SERVER (consigliato, auto-usa le credenziali):
#       chmod +x aggiungi_indici.sh
#       ./aggiungi_indici.sh <host_db> <utente> <dbname>
#     es. locale (dentro il container albert_db):
#       docker exec -it albert_db bash
#       ./aggiungi_indici.sh localhost albert albert_app
#     es. server di produzione (via SSH, copiato prima sulla VPS):
#       ssh ubuntu@<VPS>
#       ./aggiungi_indici.sh db albert albert_app     # oppure localhost
#
#  2) DA FUORI, INVIANDO SOLO IL BLOCCO SQL A psql (senza usare bash):
#       estrai la parte SQL qui sotto ed esegui:
#       docker exec -i albert_db psql -U albert -d albert_app
#     incollando il blocco CREATE INDEX ... ;
#
#  NB: i comandi usano PGPASSWORD se impostata, altrimenti chiedono password.
# =============================================================================
set -euo pipefail

SQL_BLOCK=$(cat <<'SQL'
-- Indice sulle transazioni per portafoglio (usato dal ricalcolo saldi)
CREATE INDEX IF NOT EXISTS ix_transazioni_id_portafoglio
    ON transazioni (id_portafoglio);

-- Indice composto (id_portafoglio, direzione, nascosto): il ricalcolo filtra
-- per portafoglio, separa entrate(2)/uscite(1) ed esclude nascosto; evita un
-- secondo scan. (Potrebbe già esistere da commit precedenti.)
CREATE INDEX IF NOT EXISTS ix_transazioni_pf_direzione
    ON transazioni (id_portafoglio, direzione, nascosto);
SQL
)

run_psql() {
    if [ $# -ge 3 ]; then
        psql -h "$1" -U "$2" -d "$3" --set ON_ERROR_STOP=1 -v ON_ERROR_STOP=1 <<<"$SQL_BLOCK"
    else
        # modalità pipe: esegue il blocco sullo stdin di psql già aperto
        psql --set ON_ERROR_STOP=1 <<<"$SQL_BLOCK"
    fi
}

if [ $# -ge 3 ]; then
    echo "Eseguo sugli indici su host=$1 db=$3 utente=$2"
    run_psql "$1" "$2" "$3"
else
    echo "Nessun parametro: presumo connessione psql già attiva (es. dentro albert_db)."
    echo "Se sei dentro il container usa:  ./aggiungi_indici.sh localhost albert albert_app"
    run_psql
fi

echo
echo "=== Indici attuali su transazioni ==="
if [ $# -ge 3 ]; then
    psql -h "$1" -U "$2" -d "$3" -c "SELECT indexname FROM pg_indexes WHERE tablename='transazioni' ORDER BY indexname;"
else
    psql -c "SELECT indexname FROM pg_indexes WHERE tablename='transazioni' ORDER BY indexname;"
fi
echo "OK"
