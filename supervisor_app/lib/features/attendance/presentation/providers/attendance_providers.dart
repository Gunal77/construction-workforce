import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/utils/auth_error_handler.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../../data/models/attendance_model.dart';
import '../../data/datasources/attendance_remote_datasource.dart';

// Providers
final attendanceRemoteDataSourceProvider = Provider<AttendanceRemoteDataSource>((ref) {
  return AttendanceRemoteDataSource(ref.watch(apiClientProvider));
});

// Attendance list provider
final attendanceProvider = FutureProvider<List<AttendanceModel>>((ref) async {
  try {
    print('🔍 Fetching attendance...');
    final dataSource = ref.watch(attendanceRemoteDataSourceProvider);
    final attendance = await dataSource.getAttendance();
    print('✅ Attendance fetched successfully: ${attendance.length} records');
    return attendance;
  } catch (e) {
    print('💥 Exception in attendanceProvider: $e');
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

// Filtered attendance provider
final filteredAttendanceProvider = FutureProvider.family<List<AttendanceModel>, Map<String, String?>>((ref, filters) async {
  final dataSource = ref.watch(attendanceRemoteDataSourceProvider);
  return await dataSource.getAttendance(
    workerId: filters['workerId'],
    date: filters['date'],
    month: filters['month'],
    year: filters['year'],
    startDate: filters['startDate'],
    endDate: filters['endDate'],
  );
});

