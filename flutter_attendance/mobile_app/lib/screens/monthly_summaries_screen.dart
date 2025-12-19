import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_app_bar.dart';
import 'monthly_summary_detail_screen.dart';

class MonthlySummariesScreen extends StatefulWidget {
  const MonthlySummariesScreen({
    super.key,
    required this.onBackPressed,
  });

  final VoidCallback onBackPressed;

  @override
  State<MonthlySummariesScreen> createState() => _MonthlySummariesScreenState();
}

class _MonthlySummariesScreenState extends State<MonthlySummariesScreen> {
  List<dynamic> _summaries = [];
  bool _isLoading = true;
  String? _errorMessage;
  int? _selectedMonth;
  int? _selectedYear;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _selectedMonth = now.month;
    _selectedYear = now.year;
    _loadSummaries();
  }

  Future<void> _loadSummaries() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final summaries = await ApiService().fetchMonthlySummaries(
        month: _selectedMonth,
        year: _selectedYear,
      );
      if (mounted) {
        setState(() {
          _summaries = summaries;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = error is ApiException
              ? error.message
              : 'Failed to fetch monthly summaries';
        });
      }
    }
  }

  String _getStatusBadge(String status) {
    switch (status) {
      case 'DRAFT':
        return 'Draft';
      case 'SIGNED_BY_STAFF':
        return 'Signed';
      case 'APPROVED':
        return 'Approved';
      case 'REJECTED':
        return 'Rejected';
      default:
        return status;
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'DRAFT':
        return Colors.grey;
      case 'SIGNED_BY_STAFF':
        return Colors.blue;
      case 'APPROVED':
        return Colors.green;
      case 'REJECTED':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _getMonthName(int month) {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];
    return months[month - 1];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(
        title: 'Monthly Summaries',
        showBackButton: true,
      ),
      body: RefreshIndicator(
        onRefresh: _loadSummaries,
        child: Column(
          children: [
            // Filter Section
            Container(
              padding: const EdgeInsets.all(16),
              color: AppTheme.cardColor,
              child: Row(
                children: [
                  Expanded(
                    child: DropdownButton<int>(
                      value: _selectedMonth,
                      isExpanded: true,
                      hint: const Text('Month'),
                      items: List.generate(12, (index) {
                        return DropdownMenuItem(
                          value: index + 1,
                          child: Text(_getMonthName(index + 1)),
                        );
                      }),
                      onChanged: (value) {
                        setState(() {
                          _selectedMonth = value;
                        });
                        _loadSummaries();
                      },
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: DropdownButton<int>(
                      value: _selectedYear,
                      isExpanded: true,
                      hint: const Text('Year'),
                      items: List.generate(5, (index) {
                        final year = DateTime.now().year - 2 + index;
                        return DropdownMenuItem(
                          value: year,
                          child: Text(year.toString()),
                        );
                      }),
                      onChanged: (value) {
                        setState(() {
                          _selectedYear = value;
                        });
                        _loadSummaries();
                      },
                    ),
                  ),
                ],
              ),
            ),

            // Content
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _errorMessage != null
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.error_outline,
                                size: 64,
                                color: Colors.red.shade300,
                              ),
                              const SizedBox(height: 16),
                              Text(
                                _errorMessage!,
                                style: GoogleFonts.poppins(
                                  fontSize: 16,
                                  color: AppTheme.textColor,
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _loadSummaries,
                                child: const Text('Retry'),
                              ),
                            ],
                          ),
                        )
                      : _summaries.isEmpty
                          ? Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(
                                    Icons.description_outlined,
                                    size: 64,
                                    color: Colors.grey.shade300,
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    'No monthly summaries found',
                                    style: GoogleFonts.poppins(
                                      fontSize: 16,
                                      color: AppTheme.textColor,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Summaries will appear here once generated',
                                    style: GoogleFonts.poppins(
                                      fontSize: 14,
                                      color: Colors.grey.shade600,
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.all(16),
                              itemCount: _summaries.length,
                              itemBuilder: (context, index) {
                                final summary = _summaries[index];
                                final status = summary['status'] ?? 'DRAFT';
                                final month = summary['month'] ?? 1;
                                final year = summary['year'] ?? DateTime.now().year;
                                // Parse string values from backend (DECIMAL types come as strings)
                                final totalHours = double.tryParse(
                                  summary['total_worked_hours']?.toString() ?? '0'
                                ) ?? 0.0;
                                final otHours = double.tryParse(
                                  summary['total_ot_hours']?.toString() ?? '0'
                                ) ?? 0.0;

                                return Card(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  elevation: 2,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: InkWell(
                                    onTap: () {
                                      Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (context) =>
                                              MonthlySummaryDetailScreen(
                                            summaryId: summary['id'],
                                            onSigned: () {
                                              _loadSummaries();
                                            },
                                          ),
                                        ),
                                      );
                                    },
                                    borderRadius: BorderRadius.circular(12),
                                    child: Padding(
                                      padding: const EdgeInsets.all(16),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.spaceBetween,
                                            children: [
                                              Text(
                                                '${_getMonthName(month)} $year',
                                                style: GoogleFonts.poppins(
                                                  fontSize: 18,
                                                  fontWeight: FontWeight.w600,
                                                  color: AppTheme.textColor,
                                                ),
                                              ),
                                              Container(
                                                padding: const EdgeInsets.symmetric(
                                                  horizontal: 12,
                                                  vertical: 6,
                                                ),
                                                decoration: BoxDecoration(
                                                  color: _getStatusColor(status)
                                                      .withOpacity(0.1),
                                                  borderRadius:
                                                      BorderRadius.circular(20),
                                                  border: Border.all(
                                                    color: _getStatusColor(status),
                                                    width: 1,
                                                  ),
                                                ),
                                                child: Text(
                                                  _getStatusBadge(status),
                                                  style: GoogleFonts.poppins(
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.w600,
                                                    color:
                                                        _getStatusColor(status),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 12),
                                          Row(
                                            children: [
                                              Expanded(
                                                child: _buildStatItem(
                                                  'Total Hours',
                                                  totalHours.toStringAsFixed(2),
                                                  Icons.access_time,
                                                ),
                                              ),
                                              Expanded(
                                                child: _buildStatItem(
                                                  'OT Hours',
                                                  otHours.toStringAsFixed(2),
                                                  Icons.timer,
                                                  color: Colors.orange,
                                                ),
                                              ),
                                            ],
                                          ),
                                          if (status == 'DRAFT')
                                            Padding(
                                              padding:
                                                  const EdgeInsets.only(top: 12),
                                              child: Container(
                                                padding: const EdgeInsets.all(12),
                                                decoration: BoxDecoration(
                                                  color: Colors.blue.shade50,
                                                  borderRadius:
                                                      BorderRadius.circular(8),
                                                ),
                                                child: Row(
                                                  children: [
                                                    Icon(
                                                      Icons.info_outline,
                                                      size: 20,
                                                      color: Colors.blue.shade700,
                                                    ),
                                                    const SizedBox(width: 8),
                                                    Expanded(
                                                      child: Text(
                                                        'Tap to review and sign',
                                                        style: GoogleFonts.poppins(
                                                          fontSize: 12,
                                                          color:
                                                              Colors.blue.shade700,
                                                        ),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon,
      {Color? color}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              icon,
              size: 16,
              color: color ?? Colors.grey.shade600,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: GoogleFonts.poppins(
                fontSize: 12,
                color: Colors.grey.shade600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: GoogleFonts.poppins(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: AppTheme.textColor,
          ),
        ),
      ],
    );
  }
}

