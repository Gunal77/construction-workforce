import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:convert';
import 'dart:typed_data';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/signature_pad.dart';

class MonthlySummaryDetailScreen extends StatefulWidget {
  const MonthlySummaryDetailScreen({
    super.key,
    required this.summaryId,
    this.month,
    this.year,
    required this.onSigned,
  });

  final String? summaryId;
  final int? month;
  final int? year;
  final VoidCallback onSigned;

  @override
  State<MonthlySummaryDetailScreen> createState() =>
      _MonthlySummaryDetailScreenState();
}

class _MonthlySummaryDetailScreenState
    extends State<MonthlySummaryDetailScreen> {
  Map<String, dynamic>? _summary;
  bool _isLoading = true;
  bool _isSigning = false;
  String? _errorMessage;
  String? _signature;
  int? _summaryMonth;
  int? _summaryYear;

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      Map<String, dynamic> response;
      
      // Try ID-based lookup first if ID is provided
      if (widget.summaryId != null && widget.summaryId!.isNotEmpty) {
        try {
          response = await ApiService().fetchMonthlySummaryById(widget.summaryId!);
        } catch (idError) {
          // If ID lookup fails and we have month/year, try alternative method
          if (widget.month != null && widget.year != null) {
            print('[DEBUG] ID lookup failed, trying month/year lookup: ${idError.toString()}');
            response = await ApiService().fetchMonthlySummaryByMonth(widget.month!, widget.year!);
          } else {
            rethrow;
          }
        }
      } else if (widget.month != null && widget.year != null) {
        // Use month/year lookup if no ID provided
        response = await ApiService().fetchMonthlySummaryByMonth(widget.month!, widget.year!);
      } else {
        throw ApiException('Summary ID or month/year is required');
      }
      
      if (mounted) {
        setState(() {
          _summary = response['summary'];
          // Store month/year from loaded summary for signing
          if (_summary != null) {
            _summaryMonth = _summary!['month'] ?? widget.month;
            _summaryYear = _summary!['year'] ?? widget.year;
            print('[DEBUG] Loaded summary - ID: ${_summary!['id']}, _id: ${_summary!['_id']}, Month: $_summaryMonth, Year: $_summaryYear');
          } else {
            _summaryMonth = widget.month;
            _summaryYear = widget.year;
          }
          _isLoading = false;
          
          // Check if it's an empty state response
          if (response['empty'] == true) {
            _errorMessage = response['message'] ?? 'Monthly summary not generated yet. Please contact admin.';
          }
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          if (error is ApiException && error.statusCode == 404) {
            _errorMessage = 'Monthly summary not generated yet. Please contact admin.';
          } else {
            _errorMessage = error is ApiException
                ? error.message
                : 'Failed to load monthly summary';
          }
        });
      }
    }
  }

  Future<void> _handleSign() async {
    if (_signature == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please provide your signature')),
      );
      return;
    }

    if (_summary == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Summary data is missing. Please reload the page.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() {
      _isSigning = true;
      _errorMessage = null;
    });

    try {
      // Priority 1: Use summary ID from loaded summary (most reliable)
      String? summaryId = _summary?['id']?.toString();
      if (summaryId == null || summaryId.isEmpty) {
        summaryId = _summary?['_id']?.toString();
      }
      if (summaryId == null || summaryId.isEmpty) {
        summaryId = widget.summaryId?.toString();
      }
      
      // Priority 2: Use month/year from loaded summary
      int? monthToUse = _summary?['month'];
      int? yearToUse = _summary?['year'];
      
      // Priority 3: Fallback to stored or widget values
      if (monthToUse == null) monthToUse = _summaryMonth ?? widget.month;
      if (yearToUse == null) yearToUse = _summaryYear ?? widget.year;
      
      print('[DEBUG] Sign attempt - SummaryID: $summaryId, Month: $monthToUse, Year: $yearToUse');
      print('[DEBUG] Loaded summary data - ID: ${_summary?['id']}, _id: ${_summary?['_id']}, Month: ${_summary?['month']}, Year: ${_summary?['year']}');
      
      // Try ID-based signing first (most reliable if we have the ID)
      if (summaryId != null && summaryId.isNotEmpty) {
        try {
          print('[DEBUG] Attempting ID-based sign with ID: $summaryId');
          await ApiService().signMonthlySummary(summaryId, _signature!);
          print('[DEBUG] ID-based sign successful');
        } catch (idError) {
          print('[DEBUG] ID-based sign failed: ${idError.toString()}');
          // If ID signing fails and we have month/year, try month/year signing
          if (monthToUse != null && yearToUse != null) {
            print('[DEBUG] Falling back to month/year sign - Month: $monthToUse, Year: $yearToUse');
            await ApiService().signMonthlySummaryByMonth(monthToUse, yearToUse, _signature!);
            print('[DEBUG] Month/year sign successful');
          } else {
            rethrow;
          }
        }
      } else if (monthToUse != null && yearToUse != null) {
        // No ID available, use month/year signing
        print('[DEBUG] No ID available, using month/year sign - Month: $monthToUse, Year: $yearToUse');
        await ApiService().signMonthlySummaryByMonth(monthToUse, yearToUse, _signature!);
        print('[DEBUG] Month/year sign successful');
      } else {
        throw ApiException('Summary ID or month/year is required. Please reload the page.');
      }
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Monthly summary signed successfully'),
            backgroundColor: Colors.green,
          ),
        );
        widget.onSigned();
        Navigator.pop(context);
      }
    } catch (error) {
      print('[ERROR] Sign error: $error');
      String errorMsg = 'Failed to sign monthly summary';
      
      if (error is ApiException) {
        // Use the backend's error message directly - it's more accurate
        errorMsg = error.message;
        // Only override for specific cases
        if (error.statusCode == 400 && error.message.contains('already signed')) {
          errorMsg = error.message; // Use the exact message for already signed
        }
        // For 404, use backend message (should be "Monthly summary not found" not employee record)
        // For 403, use backend message (should be "Unauthorized" not employee record)
      } else {
        errorMsg = 'Failed to sign monthly summary: ${error.toString()}';
      }
      
      if (mounted) {
        setState(() {
          _isSigning = false;
          _errorMessage = errorMsg;
        });
        
        // Show error snackbar
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 5),
          ),
        );
      }
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
      appBar: AppBar(
        title: Text(
          'Monthly Summary',
          style: GoogleFonts.poppins(
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: AppTheme.primaryColor,
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null && _summary == null
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
                        onPressed: _loadSummary,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _summary == null && _errorMessage != null
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
                            _errorMessage ?? 'Monthly summary not generated yet. Please contact admin.',
                            style: GoogleFonts.poppins(
                              fontSize: 16,
                              color: AppTheme.textColor,
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Summaries are generated by administrators.',
                            style: GoogleFonts.poppins(
                              fontSize: 14,
                              color: Colors.grey.shade600,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  : _summary == null
                      ? const Center(child: CircularProgressIndicator())
                      : SingleChildScrollView(
                      physics: const ClampingScrollPhysics(),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Header
                          Card(
                            elevation: 2,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${_getMonthName(_summary!['month'] ?? 1)} ${_summary!['year'] ?? DateTime.now().year}',
                                    style: GoogleFonts.poppins(
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                      color: AppTheme.textColor,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  _buildStatusBadge(_summary!['status'] ?? 'DRAFT'),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(height: 16),

                          // Summary Metrics
                          Card(
                            elevation: 2,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Summary',
                                    style: GoogleFonts.poppins(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w600,
                                      color: AppTheme.textColor,
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  _buildMetricRow(
                                    'Working Days',
                                    (_summary!['total_working_days'] ?? 0).toString(),
                                    Icons.calendar_today,
                                  ),
                                  const Divider(),
                                  _buildMetricRow(
                                    'Total Hours',
                                    (double.tryParse(_summary!['total_worked_hours']?.toString() ?? '0') ?? 0)
                                        .toStringAsFixed(2),
                                    Icons.access_time,
                                  ),
                                  const Divider(),
                                  _buildMetricRow(
                                    'OT Hours',
                                    (double.tryParse(_summary!['total_ot_hours']?.toString() ?? '0') ?? 0)
                                        .toStringAsFixed(2),
                                    Icons.timer,
                                    color: Colors.orange,
                                  ),
                                  const Divider(),
                                  _buildMetricRow(
                                    'Approved Leaves',
                                    (double.tryParse(_summary!['approved_leaves']?.toString() ?? '0') ?? 0)
                                        .toStringAsFixed(2),
                                    Icons.event_available,
                                    color: Colors.green,
                                  ),
                                  const Divider(),
                                  _buildMetricRow(
                                    'Absent Days',
                                    (_summary!['absent_days'] ?? 0).toString(),
                                    Icons.event_busy,
                                    color: Colors.red,
                                  ),
                                ],
                              ),
                            ),
                          ),

                          // Project Breakdown
                          if (_summary!['project_breakdown'] != null &&
                              (_summary!['project_breakdown'] as List).isNotEmpty)
                            ..._buildProjectBreakdown(),

                          // Staff Signature Section
                          // Show sign section if DRAFT or REJECTED (to allow re-signing)
                          if (_summary!['status'] == 'DRAFT' || _summary!['status'] == 'REJECTED')
                            _buildSignSection(),
                          // Show signed signature if status is SIGNED_BY_STAFF or APPROVED
                          if ((_summary!['status'] == 'SIGNED_BY_STAFF' || _summary!['status'] == 'APPROVED') && 
                              _summary!['staff_signature'] != null)
                            _buildSignatureDisplay(
                              'Staff Signature',
                              _summary!['staff_signature'],
                              _summary!['staff_signed_at'],
                            ),
                          // Show status message for SIGNED_BY_STAFF
                          if (_summary!['status'] == 'SIGNED_BY_STAFF')
                            _buildStatusMessage('Waiting for Admin Approval', Colors.blue),
                          // Show status message for APPROVED
                          if (_summary!['status'] == 'APPROVED')
                            _buildStatusMessage('Approved - Payroll Ready', Colors.green),
                          // Show status message for REJECTED (if not showing sign section)
                          if (_summary!['status'] == 'REJECTED' && _summary!['staff_signature'] != null)
                            _buildStatusMessage('Rejected - Please Review and Re-sign', Colors.red),

                          // Admin Signature (if approved/rejected)
                          if (_summary!['admin_signature'] != null)
                            _buildSignatureDisplay(
                              'Admin Signature',
                              _summary!['admin_signature'],
                              _summary!['admin_approved_at'],
                            ),

                          if (_errorMessage != null)
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.red.shade50,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: Colors.red.shade200),
                                ),
                                child: Text(
                                  _errorMessage!,
                                  style: GoogleFonts.poppins(
                                    color: Colors.red.shade700,
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    String label;
    switch (status) {
      case 'DRAFT':
        color = Colors.grey;
        label = 'Draft - Pending Your Signature';
        break;
      case 'SIGNED_BY_STAFF':
        color = Colors.blue;
        label = 'Signed - Pending Admin Approval';
        break;
      case 'APPROVED':
        color = Colors.green;
        label = 'Approved';
        break;
      case 'REJECTED':
        color = Colors.red;
        label = 'Rejected';
        break;
      default:
        color = Colors.grey;
        label = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color, width: 1),
      ),
      child: Text(
        label,
        style: GoogleFonts.poppins(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }

  Widget _buildMetricRow(String label, String value, IconData icon,
      {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: color ?? Colors.grey.shade600),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.poppins(
                fontSize: 14,
                color: Colors.grey.shade700,
              ),
            ),
          ),
          Text(
            value,
            style: GoogleFonts.poppins(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppTheme.textColor,
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildProjectBreakdown() {
    final breakdown = _summary!['project_breakdown'] as List;
    return [
      const SizedBox(height: 16),
      Card(
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Project Breakdown',
                style: GoogleFonts.poppins(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.textColor,
                ),
              ),
              const SizedBox(height: 12),
              ...breakdown.map((project) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        project['project_name'] ?? 'Unassigned',
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppTheme.textColor,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Days: ${project['days_worked'] ?? 0}',
                              style: GoogleFonts.poppins(
                                fontSize: 12,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              'Hours: ${(double.tryParse(project['total_hours']?.toString() ?? '0') ?? 0).toStringAsFixed(2)}',
                              style: GoogleFonts.poppins(
                                fontSize: 12,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              'OT: ${(double.tryParse(project['ot_hours']?.toString() ?? '0') ?? 0).toStringAsFixed(2)}',
                              style: GoogleFonts.poppins(
                                fontSize: 12,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }).toList(),
            ],
          ),
        ),
      ),
    ];
  }

  Widget _buildSignSection() {
    final isRejected = _summary!['status'] == 'REJECTED';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        Card(
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isRejected ? 'Re-sign Monthly Summary' : 'Sign Monthly Summary',
                  style: GoogleFonts.poppins(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textColor,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isRejected ? Colors.red.shade50 : Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isRejected ? Icons.warning_amber_rounded : Icons.info_outline,
                        size: 20,
                        color: isRejected ? Colors.red.shade700 : Colors.blue.shade700,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          isRejected
                              ? 'This summary was rejected by admin. Please review and re-sign after corrections.'
                              : 'Please review the summary above and sign to confirm. Once signed, you cannot make changes.',
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: isRejected ? Colors.red.shade700 : Colors.blue.shade700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (isRejected && _summary!['admin_remarks'] != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Admin Remarks:',
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey.shade700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _summary!['admin_remarks'],
                          style: GoogleFonts.poppins(
                            fontSize: 12,
                            color: Colors.grey.shade800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                // Wrap signature pad to prevent scroll interference
                NotificationListener<ScrollNotification>(
                  onNotification: (notification) {
                    // Prevent scroll when interacting with signature pad
                    return true;
                  },
                  child: SignaturePad(
                    onSignatureSaved: (signature) {
                      setState(() {
                        _signature = signature;
                      });
                    },
                    enabled: !_isSigning,
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isSigning || _signature == null
                        ? null
                        : _handleSign,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primaryColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isSigning
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor:
                                  AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : Text(
                            isRejected ? 'Re-sign & Submit' : 'Confirm & Sign',
                            style: GoogleFonts.poppins(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSignatureDisplay(String title, String signature, String? timestamp) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        Card(
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.poppins(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textColor,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  height: 150,
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(8),
                    color: Colors.white,
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.memory(
                      _decodeBase64Image(signature),
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                if (timestamp != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Signed on: ${_formatTimestamp(timestamp)}',
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Uint8List _decodeBase64Image(String base64String) {
    // Remove data URI prefix if present
    String base64Data = base64String;
    if (base64String.contains(',')) {
      base64Data = base64String.split(',')[1];
    }
    return Uint8List.fromList(base64Decode(base64Data));
  }

  String _formatTimestamp(String timestamp) {
    try {
      final date = DateTime.parse(timestamp);
      return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
    } catch (e) {
      return timestamp;
    }
  }

  Widget _buildStatusMessage(String message, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3), width: 1.5),
        ),
        child: Row(
          children: [
            Icon(
              color == Colors.green ? Icons.check_circle : Icons.hourglass_empty,
              color: color,
              size: 24,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

