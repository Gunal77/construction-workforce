import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/utils/result.dart';
import '../../../../core/utils/auth_error_handler.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../../data/models/worker_model.dart';
import '../../data/datasources/workers_remote_datasource.dart';
import '../../data/repositories/workers_repository_impl.dart';

// Providers
final workersRemoteDataSourceProvider = Provider<WorkersRemoteDataSource>((ref) {
  return WorkersRemoteDataSource(ref.watch(apiClientProvider));
});

final workersRepositoryProvider = Provider<WorkersRepositoryImpl>((ref) {
  return WorkersRepositoryImpl(
    remoteDataSource: ref.watch(workersRemoteDataSourceProvider),
  );
});

// Workers list provider
final workersProvider = FutureProvider<List<WorkerModel>>((ref) async {
  try {
    print('🔍 Fetching workers...');
    final repository = ref.watch(workersRepositoryProvider);
    final result = await repository.getWorkers();
    
    switch (result) {
      case Success<List<WorkerModel>>(:final data):
        print('✅ Workers fetched successfully: ${data.length} workers');
        return data;
      case Failure<List<WorkerModel>>(:final error):
        print('❌ Error fetching workers: $error');
        print('❌ Error type: ${error.runtimeType}');
        
        // Check if it's an authentication error
        if (AuthErrorHandler.isAuthenticationError(error)) {
          print('🔐 Authentication error detected - clearing tokens');
          final apiClient = ref.read(apiClientProvider);
          await AuthErrorHandler.handleAuthError(apiClient);
          // Invalidate auth state to trigger navigation to login
          ref.invalidate(authStateProvider);
        }
        
        // Failure always contains an Exception
        throw error;
    }
  } catch (e) {
    print('💥 Exception in workersProvider: $e');
    print('💥 Exception type: ${e.runtimeType}');
    
    // Check if it's an authentication error
    if (AuthErrorHandler.isAuthenticationError(e)) {
      print('🔐 Authentication error detected - clearing tokens');
      final apiClient = ref.read(apiClientProvider);
      await AuthErrorHandler.handleAuthError(apiClient);
      // Invalidate auth state to trigger navigation to login
      ref.invalidate(authStateProvider);
    }
    
    rethrow;
  }
});

// Worker detail provider
final workerDetailProvider = FutureProvider.family<WorkerModel?, String>((ref, workerId) async {
  final repository = ref.watch(workersRepositoryProvider);
  final result = await repository.getWorkerById(workerId);
  return switch (result) {
    Success<WorkerModel>(:final data) => data,
    Failure<WorkerModel>() => null,
  };
});

// Assign project provider
final assignProjectProvider = FutureProvider.family<WorkerModel, AssignProjectParams>((ref, params) async {
  final repository = ref.watch(workersRepositoryProvider);
  final result = await repository.assignProject(params.workerId, params.projectId);
  
  switch (result) {
    case Success<WorkerModel>(:final data):
      // Invalidate workers list and detail to refresh
      ref.invalidate(workersProvider);
      ref.invalidate(workerDetailProvider(params.workerId));
      return data;
    case Failure<WorkerModel>(:final error):
      throw error;
  }
});

// Remove project provider
final removeProjectProvider = FutureProvider.family<WorkerModel, String>((ref, workerId) async {
  final repository = ref.watch(workersRepositoryProvider);
  final result = await repository.removeProject(workerId);
  
  switch (result) {
    case Success<WorkerModel>(:final data):
      // Invalidate workers list and detail to refresh
      ref.invalidate(workersProvider);
      ref.invalidate(workerDetailProvider(workerId));
      return data;
    case Failure<WorkerModel>(:final error):
      throw error;
  }
});

class AssignProjectParams {
  final String workerId;
  final String projectId;

  AssignProjectParams({required this.workerId, required this.projectId});
}
