#!/usr/bin/env bash
set -e

# Esperar a la base de datos si DATABASE_URL está definido
if [ -n "$DATABASE_URL" ]; then
  echo "Esperando a la base de datos..."
  DB_HOST=$(python - <<'PY'
import os, re
url=os.environ.get("DATABASE_URL","")
m=re.match(r'^\w+://[^@]+@([^:/]+)(?::(\d+))?/', url)
print(m.group(1) if m else "")
PY
)
  DB_PORT=$(python - <<'PY'
import os, re
url=os.environ.get("DATABASE_URL","")
m=re.match(r'^\w+://[^@]+@([^:/]+)(?::(\d+))?/', url)
print(m.group(2) if (m and m.group(2)) else "5432")
PY
)
  until pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; do
    echo "  -> DB no lista aún. Reintentando..."
    sleep 2
  done
  echo "Base de datos lista."
fi

# Migraciones y archivos estáticos
python manage.py migrate --noinput
python manage.py collectstatic --noinput || true

exec "$@"
