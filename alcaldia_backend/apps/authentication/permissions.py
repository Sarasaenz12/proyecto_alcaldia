from rest_framework.permissions import BasePermission

class EsAdministrador(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'

class EsFuncionario(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'funcionario'