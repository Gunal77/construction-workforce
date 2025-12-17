import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/utils/auth_error_handler.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../../data/models/project_model.dart';
import '../../../../data/models/task_model.dart';
import '../../data/datasources/projects_remote_datasource.dart';

// Providers
final projectsRemoteDataSourceProvider = Provider<ProjectsRemoteDataSource>((ref) {
  return ProjectsRemoteDataSource(ref.watch(apiClientProvider));
});

// Projects list provider
final projectsProvider = FutureProvider<List<ProjectModel>>((ref) async {
  try {
    print('🔍 Fetching projects...');
    final dataSource = ref.watch(projectsRemoteDataSourceProvider);
    final projects = await dataSource.getProjects();
    print('✅ Projects fetched successfully: ${projects.length} projects');
    return projects;
  } catch (e) {
    print('💥 Exception in projectsProvider: $e');
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

// Project detail provider
final projectDetailProvider = FutureProvider.family<ProjectModel?, String>((ref, projectId) async {
  final dataSource = ref.watch(projectsRemoteDataSourceProvider);
  try {
    return await dataSource.getProjectById(projectId);
  } catch (e) {
    return null;
  }
});

// Project tasks provider
final projectTasksProvider = FutureProvider.family<List<TaskModel>, String>((ref, projectId) async {
  final dataSource = ref.watch(projectsRemoteDataSourceProvider);
  try {
    return await dataSource.getProjectTasks(projectId);
  } catch (e) {
    return [];
  }
});

