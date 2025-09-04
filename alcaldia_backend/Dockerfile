# Imagen base ligera de Python
FROM python:3.11-slim

# Metadatos
LABEL maintainer="estra"
LABEL description="Backend del Sistema de Indicadores - Alcaldía"

# Variables de entorno
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings

# Directorio de trabajo
WORKDIR /app

# Dependencias del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    libpq-dev \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Crear directorios para archivos estáticos y media
RUN mkdir -p /app/staticfiles /app/media

# Crear usuario no-root
RUN useradd --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# Copiar configuración de Gunicorn y entrypoint
COPY docker/entrypoint.sh /app/entrypoint.sh
COPY docker/gunicorn.conf.py /app/gunicorn.conf.py
RUN chmod +x /app/entrypoint.sh

# Puerto de exposición
EXPOSE 8000

# EntryPoint y comando final
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "--config", "gunicorn.conf.py", "config.wsgi:application"]
