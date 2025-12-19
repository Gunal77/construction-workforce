import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_app_bar.dart';

class ApplyLeaveScreen extends StatefulWidget {
  const ApplyLeaveScreen({super.key});

  @override
  State<ApplyLeaveScreen> createState() => _ApplyLeaveScreenState();
}

class _ApplyLeaveScreenState extends State<ApplyLeaveScreen> {
  final _formKey = GlobalKey<FormState>();
  final _reasonController = TextEditingController();
  final _imagePicker = ImagePicker();

  List<dynamic> _leaveTypes = [];
  List<dynamic> _employees = [];
  String? _selectedLeaveTypeId;
  DateTime? _startDate;
  DateTime? _endDate;
  String? _selectedStandInEmployeeId;
  File? _mcDocument;
  bool _isLoading = false;
  bool _isLoadingData = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _isLoadingData = true;
      _errorMessage = null;
    });

    try {
      // Fetch leave types (required)
      final leaveTypes = await ApiService().fetchLeaveTypes();
      
      // Fetch employees for stand-in selector (optional)
      List<dynamic> employees = [];
      try {
        employees = await ApiService().fetchEmployeesForStandIn();
      } catch (e) {
        // Employees fetch failed - stand-in selector will be empty but that's OK
        print('Note: Could not fetch employees for stand-in selector: $e');
      }

      if (mounted) {
        setState(() {
          _leaveTypes = leaveTypes;
          _employees = employees;
          _isLoadingData = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _isLoadingData = false;
          _errorMessage = error is ApiException
              ? error.message
              : 'Failed to load data';
        });
      }
    }
  }

  Future<void> _pickMCDocument() async {
    try {
      final file = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
      );

      if (file != null) {
        setState(() {
          _mcDocument = File(file.path);
        });
      }
    } catch (error) {
      _showMessage('Failed to pick document');
    }
  }

  String? _getLeaveTypeCode() {
    if (_selectedLeaveTypeId == null) return null;
    final type = _leaveTypes.firstWhere(
      (t) => t['id'] == _selectedLeaveTypeId,
      orElse: () => null,
    );
    return type?['code'];
  }

  bool get _isMCLeave => _getLeaveTypeCode() == 'SICK' || _getLeaveTypeCode() == 'MC';

  Future<void> _submitLeaveRequest() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_selectedLeaveTypeId == null) {
      _showMessage('Please select a leave type');
      return;
    }

    if (_startDate == null || _endDate == null) {
      _showMessage('Please select start and end dates');
      return;
    }

    if (_endDate!.isBefore(_startDate!)) {
      _showMessage('End date must be after start date');
      return;
    }

    if (_isMCLeave && _mcDocument == null) {
      _showMessage('Medical certificate document is required for MC leave');
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      await ApiService().createLeaveRequest(
        leaveTypeId: _selectedLeaveTypeId!,
        startDate: _startDate!.toIso8601String().split('T')[0],
        endDate: _endDate!.toIso8601String().split('T')[0],
        reason: _reasonController.text.trim().isEmpty
            ? null
            : _reasonController.text.trim(),
        standInEmployeeId: _selectedStandInEmployeeId,
        mcDocument: _mcDocument,
      );

      if (mounted) {
        _showMessage('Leave request submitted successfully', isSuccess: true);
        Navigator.of(context).pop(true); // Return true to indicate success
      }
    } catch (error) {
      if (mounted) {
        String errorMessage = 'Failed to submit leave request';
        if (error is ApiException) {
          errorMessage = error.message;
        } else {
          errorMessage = error.toString();
        }
        _showMessage(errorMessage);
        print('Leave request error: $error');
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _showMessage(String message, {bool isSuccess = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isSuccess ? Colors.green : Colors.red,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppBar(
        title: 'Apply Leave',
        showBackButton: true,
      ),
      body: _isLoadingData
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 64, color: Colors.red.shade300),
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
                        onPressed: _loadInitialData,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Leave Type
                        Text(
                          'Leave Type *',
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textColor,
                          ),
                        ),
                        const SizedBox(height: 8),
                        DropdownButtonFormField<String>(
                          value: _selectedLeaveTypeId,
                          decoration: InputDecoration(
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                          ),
                          items: _leaveTypes.map((type) {
                            return DropdownMenuItem<String>(
                              value: type['id'],
                              child: Text(type['name'] ?? ''),
                            );
                          }).toList(),
                          onChanged: (value) {
                            setState(() {
                              _selectedLeaveTypeId = value;
                              // Clear MC document if switching away from MC
                              if (!_isMCLeave) {
                                _mcDocument = null;
                              }
                            });
                          },
                          validator: (value) {
                            if (value == null) {
                              return 'Please select a leave type';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 24),

                        // Start Date
                        Text(
                          'Start Date *',
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textColor,
                          ),
                        ),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: () async {
                            final date = await showDatePicker(
                              context: context,
                              initialDate: _startDate ?? DateTime.now(),
                              firstDate: DateTime.now(),
                              lastDate: DateTime.now().add(const Duration(days: 365)),
                            );
                            if (date != null) {
                              setState(() {
                                _startDate = date;
                                // Reset end date if it's before start date
                                if (_endDate != null && _endDate!.isBefore(date)) {
                                  _endDate = null;
                                }
                              });
                            }
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.grey.shade300),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    _startDate == null
                                        ? 'Select start date'
                                        : '${_startDate!.day}/${_startDate!.month}/${_startDate!.year}',
                                    style: GoogleFonts.poppins(
                                      fontSize: 16,
                                      color: _startDate == null
                                          ? Colors.grey
                                          : AppTheme.textColor,
                                    ),
                                  ),
                                ),
                                Icon(Icons.calendar_today, color: Colors.grey.shade600),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // End Date
                        Text(
                          'End Date *',
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textColor,
                          ),
                        ),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: () async {
                            if (_startDate == null) {
                              _showMessage('Please select start date first');
                              return;
                            }
                            final date = await showDatePicker(
                              context: context,
                              initialDate: _endDate ?? _startDate!,
                              firstDate: _startDate!,
                              lastDate: DateTime.now().add(const Duration(days: 365)),
                            );
                            if (date != null) {
                              setState(() {
                                _endDate = date;
                              });
                            }
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.grey.shade300),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    _endDate == null
                                        ? 'Select end date'
                                        : '${_endDate!.day}/${_endDate!.month}/${_endDate!.year}',
                                    style: GoogleFonts.poppins(
                                      fontSize: 16,
                                      color: _endDate == null
                                          ? Colors.grey
                                          : AppTheme.textColor,
                                    ),
                                  ),
                                ),
                                Icon(Icons.calendar_today, color: Colors.grey.shade600),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Reason
                        Text(
                          'Reason',
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textColor,
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _reasonController,
                          maxLines: 4,
                          decoration: InputDecoration(
                            hintText: 'Enter reason for leave (optional)',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            contentPadding: const EdgeInsets.all(16),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Stand-In Staff (Optional)
                        Text(
                          'Stand-In Staff (Optional)',
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textColor,
                          ),
                        ),
                        const SizedBox(height: 8),
                        DropdownButtonFormField<String>(
                          value: _selectedStandInEmployeeId,
                          isExpanded: true,
                          decoration: InputDecoration(
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            hintText: 'Select stand-in staff (optional)',
                          ),
                          items: [
                            const DropdownMenuItem<String>(
                              value: null,
                              child: Text('None'),
                            ),
                            ..._employees.map((emp) {
                              final displayName = emp['name'] ?? emp['email'] ?? '';
                              return DropdownMenuItem<String>(
                                value: emp['id'],
                                child: Text(
                                  displayName,
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
                                ),
                              );
                            }),
                          ],
                          selectedItemBuilder: (context) {
                            return [
                              const Text('None'),
                              ..._employees.map((emp) {
                                final displayName = emp['name'] ?? emp['email'] ?? '';
                                return Text(
                                  displayName,
                                  overflow: TextOverflow.ellipsis,
                                  maxLines: 1,
                                );
                              }),
                            ];
                          },
                          onChanged: (value) {
                            setState(() {
                              _selectedStandInEmployeeId = value;
                            });
                          },
                        ),
                        const SizedBox(height: 24),

                        // MC Document (Required for MC leave)
                        if (_isMCLeave) ...[
                          Text(
                            'Medical Certificate Document *',
                            style: GoogleFonts.poppins(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.textColor,
                            ),
                          ),
                          const SizedBox(height: 8),
                          InkWell(
                            onTap: _pickMCDocument,
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                border: Border.all(color: Colors.grey.shade300),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    _mcDocument == null
                                        ? Icons.upload_file
                                        : Icons.check_circle,
                                    color: _mcDocument == null
                                        ? Colors.grey.shade600
                                        : Colors.green,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _mcDocument == null
                                          ? 'Upload Medical Certificate'
                                          : _mcDocument!.path.split('/').last,
                                      style: GoogleFonts.poppins(
                                        fontSize: 16,
                                        color: _mcDocument == null
                                            ? Colors.grey
                                            : AppTheme.textColor,
                                      ),
                                    ),
                                  ),
                                  if (_mcDocument != null)
                                    IconButton(
                                      icon: const Icon(Icons.close),
                                      onPressed: () {
                                        setState(() {
                                          _mcDocument = null;
                                        });
                                      },
                                    ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                        ],

                        // Submit Button
                        ElevatedButton(
                          onPressed: _isLoading ? null : _submitLeaveRequest,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primaryColor,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: _isLoading
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                  ),
                                )
                              : Text(
                                  'Submit Leave Request',
                                  style: GoogleFonts.poppins(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
    );
  }
}

