import 'dart:io';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_constants.dart';
import '../constants/app_constants.dart';
import '../errors/exception.dart';

/// API Client for handling HTTP requests
class ApiClient {
  late Dio _dio;
  String? _token;

  ApiClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': ApiConstants.contentType,
        },
      ),
    );

    _setupInterceptors();
    _loadToken();
  }

  void _setupInterceptors() {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Reload token before each request to ensure it's fresh
          await _loadToken();
          if (_token != null) {
            options.headers[ApiConstants.authorization] =
                '${ApiConstants.bearer} $_token';
            print('🔐 Request with token to: ${options.baseUrl}${options.path}');
          } else {
            print('⚠️ Warning: No token available for request to ${options.path}');
          }
          print('📡 Making request to: ${options.baseUrl}${options.path}');
          return handler.next(options);
        },
        onResponse: (response, handler) {
          print('✅ Response from ${response.requestOptions.path}: ${response.statusCode}');
          if (response.data != null) {
            print('📦 Response data keys: ${(response.data as Map).keys.toList()}');
            if (response.data is Map && (response.data as Map).containsKey('workers')) {
              print('👷 Workers count: ${(response.data['workers'] as List?)?.length ?? 0}');
            }
          }
          return handler.next(response);
        },
        onError: (error, handler) {
          print('🔴 Interceptor error: ${error.type}, message: ${error.message}');
          
          if (error.response != null) {
            final statusCode = error.response!.statusCode;
            final message = error.response!.data?['message'] ?? 'Request failed';

            if (statusCode == 401) {
              // Token expired or invalid - clear token
              print('🔐 401 Unauthorized - Clearing token');
              _clearTokenOnAuthErrorSync();
              
              return handler.reject(
                DioException(
                  requestOptions: error.requestOptions,
                  error: AuthenticationException(message),
                  response: error.response,
                  type: DioExceptionType.badResponse,
                ),
              );
            } else if (statusCode != null && statusCode >= 500) {
              return handler.reject(
                DioException(
                  requestOptions: error.requestOptions,
                  error: ServerException(message, statusCode: statusCode),
                  response: error.response,
                  type: DioExceptionType.badResponse,
                ),
              );
            } else {
              return handler.reject(
                DioException(
                  requestOptions: error.requestOptions,
                  error: ServerException(message, statusCode: statusCode),
                  response: error.response,
                  type: DioExceptionType.badResponse,
                ),
              );
            }
          } else if (error.type == DioExceptionType.connectionTimeout ||
              error.type == DioExceptionType.receiveTimeout ||
              error.type == DioExceptionType.sendTimeout) {
            return handler.reject(
              DioException(
                requestOptions: error.requestOptions,
                error: NetworkException('Connection timeout. Please check your internet connection.'),
                type: error.type,
              ),
            );
          } else if (error.type == DioExceptionType.connectionError ||
              error.type == DioExceptionType.unknown) {
            final errorMsg = error.message ?? error.error?.toString() ?? 'Network error';
            String networkMessage;
            
            if (errorMsg.contains('fetch failed') || 
                errorMsg.contains('Failed host lookup') ||
                errorMsg.contains('Connection refused') ||
                errorMsg.contains('SocketException')) {
              networkMessage = 'Cannot connect to server. Please check if the backend is running on port 4000.';
            } else {
              networkMessage = 'Network error: $errorMsg';
            }
            
            return handler.reject(
              DioException(
                requestOptions: error.requestOptions,
                error: NetworkException(networkMessage),
                type: error.type,
              ),
            );
          }

          // For any other error type, wrap it properly
          return handler.reject(
            DioException(
              requestOptions: error.requestOptions,
              error: NetworkException('Network request failed: ${error.message ?? error.error?.toString() ?? "Unknown error"}'),
              type: error.type,
            ),
          );
        },
      ),
    );
  }

  Future<void> _loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(AppConstants.authTokenKey);
    if (_token != null) {
      _token = _token!.trim();
    }
  }

  Future<void> setToken(String? token) async {
    _token = token;
    if (token != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.authTokenKey, token);
    } else {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(AppConstants.authTokenKey);
    }
  }

  String? get token => _token;

  Future<void> clearToken() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.authTokenKey);
  }

  void _clearTokenOnAuthErrorSync() {
    _token = null;
    // Clear token synchronously - SharedPreferences operations will be queued
    SharedPreferences.getInstance().then((prefs) async {
      await prefs.remove(AppConstants.authTokenKey);
      await prefs.remove(AppConstants.supervisorDataKey);
      await prefs.setBool(AppConstants.isLoggedInKey, false);
      print('🔐 Token cleared due to authentication error');
    });
  }

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.get<T>(
        path,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    } catch (e) {
      print('❌ Unexpected error in GET request: $e');
      throw NetworkException('Network request failed: ${e.toString()}');
    }
  }

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    ProgressCallback? onSendProgress,
  }) async {
    try {
      return await _dio.post<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        onSendProgress: onSendProgress,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.put<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await _dio.delete<T>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  Future<Response<T>> uploadFile<T>(
    String path,
    File file, {
    String fileField = 'file',
    Map<String, dynamic>? data,
    ProgressCallback? onSendProgress,
  }) async {
    try {
      final formData = FormData.fromMap({
        ...?data,
        fileField: await MultipartFile.fromFile(file.path),
      });

      return await _dio.post<T>(
        path,
        data: formData,
        onSendProgress: onSendProgress,
        options: Options(
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        ),
      );
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  AppException _handleDioError(DioException error) {
    print('🔴 DioException: ${error.type}, message: ${error.message}');
    
    if (error.error is AppException) {
      return error.error as AppException;
    }

    if (error.response != null) {
      final message = error.response!.data?['message'] ?? 'Request failed';
      final statusCode = error.response!.statusCode;

      if (statusCode == 401) {
        return AuthenticationException(message);
      } else if (statusCode != null && statusCode >= 500) {
        return ServerException(message, statusCode: statusCode);
      } else {
        return ServerException(message, statusCode: statusCode);
      }
    } else if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return NetworkException('Connection timeout. Please check your internet connection.');
    } else if (error.type == DioExceptionType.connectionError) {
      return NetworkException('Unable to connect to server. Please check if the backend is running.');
    } else if (error.type == DioExceptionType.unknown) {
      // Handle cases where DioException wraps other errors
      final errorMessage = error.message ?? error.error?.toString() ?? 'Network request failed';
      if (errorMessage.contains('fetch failed') || 
          errorMessage.contains('Failed host lookup') ||
          errorMessage.contains('Connection refused')) {
        return NetworkException('Cannot connect to server. Please check if the backend is running on port 4000.');
      }
      return NetworkException(errorMessage);
    }

    return NetworkException('Network error: ${error.message ?? 'Unknown error'}');
  }
}

