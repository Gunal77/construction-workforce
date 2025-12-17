import '../errors/exception.dart';
import '../../core/network/api_client.dart';
import '../../features/auth/data/datasources/auth_local_datasource.dart';

/// Helper to handle authentication errors and trigger logout
class AuthErrorHandler {
  /// Check if error is authentication related
  static bool isAuthenticationError(dynamic error) {
    if (error is AuthenticationException) {
      return true;
    }
    if (error is Exception) {
      final errorString = error.toString().toLowerCase();
      return errorString.contains('token expired') ||
          errorString.contains('unauthorized') ||
          errorString.contains('authentication') ||
          errorString.contains('401');
    }
    return false;
  }

  /// Handle authentication error by clearing tokens
  static Future<void> handleAuthError(ApiClient apiClient) async {
    try {
      print('🔐 Handling authentication error - clearing tokens');
      await apiClient.clearToken();
      final localDataSource = AuthLocalDataSource();
      await localDataSource.clearToken();
      print('✅ Tokens cleared - user will need to login again');
    } catch (e) {
      print('Error during auth error handling: $e');
    }
  }
}

