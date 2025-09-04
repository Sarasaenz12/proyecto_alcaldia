from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny
from django.db.models import Q
from django.http import JsonResponse
from django.core.paginator import Paginator
from .models import ArchivoExcel, RegistroDato
from .serializers import (
    ArchivoExcelSerializer,
    ArchivoExcelListSerializer,
    RegistroDatoSerializer,
    FiltroSerializer,
    EstadisticasSerializer,
    CargaMasivaSerializer
)
from .utils import FiltrosExcel, EstadisticasExcel, ExcelProcessor
from .models import ArchivoExcel
from .serializers import ArchivoExcelSerializer
import matplotlib.pyplot as plt
import io
import base64
import seaborn as sns

class ArchivoExcelListCreateView(generics.ListCreateAPIView):
    """
    Vista para listar y crear archivos Excel
    """

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]  # ✅ GET público
        return [IsAuthenticated()]  # ✅ POST protegido

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ArchivoExcelSerializer
        return ArchivoExcelListSerializer

    def get_queryset(self):
        queryset = ArchivoExcel.objects.all()

        # Filtros opcionales
        anio = self.request.query_params.get('anio')
        dependencia = self.request.query_params.get('dependencia')
        usuario = self.request.query_params.get('usuario')

        if anio:
            queryset = queryset.filter(anio=anio)
        if dependencia:
            queryset = queryset.filter(dependencia__icontains=dependencia)
        if usuario:
            queryset = queryset.filter(usuario_subida=usuario)

        return queryset.order_by('-fecha_subida')


class ArchivoExcelDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Vista para ver, actualizar y eliminar archivos Excel específicos
    """
    queryset = ArchivoExcel.objects.all()
    serializer_class = ArchivoExcelSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]   # ✅ invitado puede ver detalle
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        archivo = self.get_object()

        # Solo el propietario o admin puede eliminar
        if not (request.user.is_admin() or archivo.usuario_subida == request.user):
            return Response(
                {"error": "No tienes permisos para eliminar este archivo"},
                status=status.HTTP_403_FORBIDDEN
            )

        return super().destroy(request, *args, **kwargs)


class RegistroDatoListView(generics.ListAPIView):
    """
    Vista para listar registros de datos con filtros
    """
    serializer_class = RegistroDatoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = RegistroDato.objects.select_related('archivo')

        # Aplicar filtros
        filtros = {}
        for param in ['archivo_id', 'anio', 'dependencia', 'indicador']:
            value = self.request.query_params.get(param)
            if value:
                filtros[param] = value

        # Filtros personalizados en JSON
        campo_personalizado = self.request.query_params.get('campo_personalizado')
        valor_personalizado = self.request.query_params.get('valor_personalizado')

        if campo_personalizado and valor_personalizado:
            filtros['filtros_json'] = {campo_personalizado: valor_personalizado}

        if filtros:
            queryset = FiltrosExcel.filtrar_registros(filtros)

        return queryset.order_by('archivo', 'numero_fila')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def estadisticas_view(request):
    """
    Vista para obtener estadísticas generales
    """
    try:
        total_archivos = ArchivoExcel.objects.count()
        total_registros = RegistroDato.objects.count()
        archivos_procesados = ArchivoExcel.objects.filter(procesado=True).count()

        # Obtener dependencias y años únicos
        dependencias = RegistroDato.objects.values_list('dependencia', flat=True).distinct()
        dependencias_disponibles = [dep for dep in dependencias if dep]

        anos = RegistroDato.objects.values_list('anio', flat=True).distinct()
        anos_disponibles = [ano for ano in anos if ano]

        estadisticas = {
            'total_archivos': total_archivos,
            'total_registros': total_registros,
            'archivos_procesados': archivos_procesados,
            'dependencias_unicas': len(dependencias_disponibles),
            'anos_disponibles': sorted(anos_disponibles),
            'dependencias_disponibles': sorted(dependencias_disponibles)
        }

        serializer = EstadisticasSerializer(estadisticas)
        return Response(serializer.data)

    except Exception as e:
        return Response(
            {'error': f'Error al obtener estadísticas: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def resumen_archivo_view(request, archivo_id):
    """
    Vista para obtener resumen de un archivo específico
    """
    try:
        resumen = EstadisticasExcel.resumen_archivo(archivo_id)
        return Response(resumen)

    except ArchivoExcel.DoesNotExist:
        return Response(
            {'error': 'Archivo no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': f'Error al obtener resumen: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def valores_unicos_view(request):
    """
    Vista para obtener valores únicos de un campo
    """
    campo = request.query_params.get('campo')
    archivo_id = request.query_params.get('archivo_id')

    if not campo:
        return Response(
            {'error': 'Debe especificar el campo'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        valores = FiltrosExcel.obtener_valores_unicos(
            campo=campo,
            archivo_id=int(archivo_id) if archivo_id else None
        )

        return Response({'valores': valores})

    except Exception as e:
        return Response(
            {'error': f'Error al obtener valores únicos: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generar_grafico_view(request):
    """
    Vista para generar datos para gráficos con filtros mejorados
    """
    try:
        tipo_grafico = request.data.get('tipo_grafico', 'por_dependencia')
        filtros = request.data.get('filtros', {})

        print(f"DEBUG - Tipo gráfico: {tipo_grafico}")
        print(f"DEBUG - Filtros recibidos: {filtros}")

        # Asegurar que se use el último archivo del usuario si no se especifica
        if 'archivo_id' not in filtros:
            ultimo_archivo = ArchivoExcel.objects.filter(
                usuario_subida=request.user
            ).order_by('-fecha_subida').first()

            if ultimo_archivo:
                filtros['archivo_id'] = ultimo_archivo.id
                print(f"DEBUG - Usando último archivo: {ultimo_archivo.id}")
            else:
                return Response({
                    'error': 'No hay archivos disponibles',
                    'labels': [],
                    'values': [],
                    'title': 'Sin datos'
                })

        # Procesar filtros de búsqueda de texto
        if 'busqueda_texto' in filtros:
            busqueda = filtros['busqueda_texto']
            print(f"DEBUG - Búsqueda de texto: {busqueda}")

        # Generar datos para el gráfico
        datos_grafico = EstadisticasExcel.datos_para_grafico(tipo_grafico, filtros)

        print(f"DEBUG - Datos generados: {len(datos_grafico.get('labels', []))} elementos")

        return Response(datos_grafico)

    except Exception as e:
        print(f"ERROR en generar_grafico_view: {str(e)}")
        import traceback
        traceback.print_exc()

        return Response({
            'error': f'Error al generar gráfico: {str(e)}',
            'labels': [],
            'values': [],
            'title': 'Error'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def carga_masiva_view(request):
    """
    Vista para carga masiva de archivos
    """
    serializer = CargaMasivaSerializer(data=request.data, context={'request': request})

    if serializer.is_valid():
        try:
            archivos = serializer.validated_data['archivos']
            descripcion = serializer.validated_data.get('descripcion_general', '')

            archivos_creados = []
            errores = []

            for archivo in archivos:
                try:
                    # Crear cada archivo
                    archivo_data = {
                        'nombre_archivo': archivo.name,
                        'archivo': archivo,
                        'descripcion': descripcion
                    }

                    archivo_serializer = ArchivoExcelSerializer(
                        data=archivo_data,
                        context={'request': request}
                    )

                    if archivo_serializer.is_valid():
                        archivo_obj = archivo_serializer.save(usuario_subida=request.user)

                        archivos_creados.append({
                            'id': archivo_obj.id,
                            'nombre': archivo_obj.nombre_archivo,
                            'status': 'success'
                        })
                    else:
                        errores.append({
                            'archivo': archivo.name,
                            'errores': archivo_serializer.errors
                        })

                except Exception as e:
                    errores.append({
                        'archivo': archivo.name,
                        'error': str(e)
                    })

            return Response({
                'archivos_creados': archivos_creados,
                'errores': errores,
                'total_procesados': len(archivos),
                'exitosos': len(archivos_creados),
                'con_errores': len(errores)
            })

        except Exception as e:
            return Response(
                {'error': f'Error en carga masiva: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([AllowAny])
def columnas_disponibles_view(request):
    """
    Retorna las columnas disponibles de un archivo específico o del último del usuario.
    """
    try:
        archivo_id = request.query_params.get('archivo_id')

        if archivo_id:
            archivo = ArchivoExcel.objects.filter(id=archivo_id).first()
        else:
            # ⚠️ Si no hay archivo_id, y el usuario no está autenticado, devolvemos error
            if not request.user or not request.user.is_authenticated:
                return Response({
                    'error': 'Debe especificar un archivo_id como invitado'
                }, status=status.HTTP_400_BAD_REQUEST)

            archivo = ArchivoExcel.objects.filter(
                usuario_subida=request.user
            ).order_by('-fecha_subida').first()

        if not archivo:
            return Response({
                'error': 'No hay archivos disponibles',
                'columnas': [],
                'total_columnas': 0,
                'total_filas': 0
            }, status=status.HTTP_404_NOT_FOUND)

        if not archivo.columnas_disponibles:
            try:
                processor = ExcelProcessor(archivo)
                processor.procesar_excel()
            except Exception as e:
                print(f"Error al reprocesar archivo: {e}")

        return Response({
            'columnas': archivo.columnas_disponibles or [],
            'total_columnas': archivo.total_columnas or 0,
            'total_filas': archivo.total_filas or 0,
            'archivo_id': archivo.id,
            'nombre_archivo': archivo.nombre_archivo
        })

    except Exception as e:
        print(f"Error en columnas_disponibles_view: {e}")
        return Response({
            'error': f'Error al obtener columnas: {str(e)}',
            'columnas': [],
            'total_columnas': 0,
            'total_filas': 0
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@api_view(['POST'])
@permission_classes([IsAuthenticated])
def buscar_registros_view(request):
    """
    Vista para búsqueda avanzada de registros
    """
    try:
        # Obtener parámetros de búsqueda
        termino = request.data.get('termino', '')
        filtros = request.data.get('filtros', {})
        page = int(request.data.get('page', 1))
        page_size = int(request.data.get('page_size', 20))

        # Construir queryset
        queryset = RegistroDato.objects.select_related('archivo')

        # Aplicar filtros básicos
        if filtros:
            queryset = FiltrosExcel.filtrar_registros(filtros)

        # Búsqueda por término
        if termino:
            queryset = queryset.filter(
                Q(indicador__icontains=termino) |
                Q(dependencia__icontains=termino) |
                Q(archivo__nombre_archivo__icontains=termino)
            )

        # Paginación
        paginator = Paginator(queryset, page_size)
        registros_paginados = paginator.get_page(page)

        # Serializar datos
        serializer = RegistroDatoSerializer(registros_paginados, many=True)

        return Response({
            'resultados': serializer.data,
            'total': paginator.count,
            'paginas': paginator.num_pages,
            'pagina_actual': page,
            'tiene_siguiente': registros_paginados.has_next(),
            'tiene_anterior': registros_paginados.has_previous()
        })

    except Exception as e:
        return Response(
            {'error': f'Error en búsqueda: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
