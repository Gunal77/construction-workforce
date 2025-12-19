import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_app_bar.dart';
import '../widgets/custom_button.dart';

class CheckInOutScreen extends StatefulWidget {
  const CheckInOutScreen({
    super.key,
    this.onBackPressed,
  });

  final VoidCallback? onBackPressed;

  @override
  State<CheckInOutScreen> createState() => _CheckInOutScreenState();
}

class _CheckInOutScreenState extends State<CheckInOutScreen> {
  final _imagePicker = ImagePicker();

  bool _isCheckingIn = false;
  bool _isCheckingOut = false;
  bool _isFetchingLocation = false;
  XFile? _selectedImage;
  XFile? _selectedCheckoutImage;
  double? _latitude;
  double? _longitude;
  double? _checkoutLatitude;
  double? _checkoutLongitude;

  Future<bool> _requestCameraPermission() async {
    final status = await Permission.camera.request();
    if (status.isDenied) {
      _showMessage('Camera permission is required to capture photos');
      return false;
    }
    if (status.isPermanentlyDenied) {
      _showMessage('Camera permission is permanently denied. Please enable it in settings.');
      return false;
    }
    return status.isGranted;
  }

  Future<bool> _requestLocationPermission() async {
    // Check if location services are enabled
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      _showMessage('Location services are disabled. Please enable GPS.');
      return false;
    }

    // Check location permission
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        _showMessage('Location permission is required to capture your location');
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      _showMessage('Location permission is permanently denied. Please enable it in settings.');
      return false;
    }

    return permission == LocationPermission.whileInUse || permission == LocationPermission.always;
  }

  Future<void> _fetchCurrentLocation() async {
    setState(() {
      _isFetchingLocation = true;
    });

    try {
      // Request location permission
      final hasPermission = await _requestLocationPermission();
      if (!hasPermission) {
        if (mounted) {
          setState(() {
            _isFetchingLocation = false;
            _latitude = null;
            _longitude = null;
          });
        }
        return;
      }

      // Try to get last known position first (faster)
      Position? lastKnownPosition;
      try {
        lastKnownPosition = await Geolocator.getLastKnownPosition();
      } catch (e) {
        // Ignore if last known position is not available
      }

      Position position;
      
      // If last known position is available, use it; otherwise get current position
      if (lastKnownPosition != null) {
        position = lastKnownPosition;
      } else {
        try {
          // Use a shorter timeout and lower accuracy for faster response
          position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.medium, // Changed from high to medium for faster response
            timeLimit: const Duration(seconds: 5), // Reduced from 10 to 5 seconds
          ).timeout(
            const Duration(seconds: 5),
            onTimeout: () {
              throw TimeoutException('Location fetch timed out');
            },
          );
        } catch (timeoutError) {
          // If timeout, try to get last known position as fallback
          final fallbackPosition = await Geolocator.getLastKnownPosition();
          if (fallbackPosition == null) {
            throw Exception('Unable to get location. Please ensure GPS is enabled.');
          }
          position = fallbackPosition;
        }
      }

      if (mounted) {
        setState(() {
          _latitude = position.latitude;
          _longitude = position.longitude;
          _isFetchingLocation = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isFetchingLocation = false;
          _latitude = null;
          _longitude = null;
        });
        final errorMessage = e.toString().contains('timeout') || e.toString().contains('Timeout')
            ? 'Location fetch timed out. Please ensure GPS is enabled and try again.'
            : 'Unable to fetch location. Please enable GPS.';
        _showMessage(errorMessage);
      }
    }
  }

  Future<void> _pickImageFromCamera() async {
    // Request camera permission
    final hasCameraPermission = await _requestCameraPermission();
    if (!hasCameraPermission) {
      return;
    }

    try {
      final image = await _imagePicker.pickImage(source: ImageSource.camera);
      if (image != null && mounted) {
        setState(() {
          _selectedImage = image;
          // Reset location when new image is captured
          _latitude = null;
          _longitude = null;
        });

        // Automatically fetch GPS location after photo is captured
        await _fetchCurrentLocation();
      }
    } catch (error) {
      _showMessage('Unable to capture image');
    }
  }

  Future<void> _handleCheckIn() async {
    if (_selectedImage == null) {
      _showMessage('Please capture a photo before checking in');
      return;
    }

    if (_latitude == null || _longitude == null) {
      _showMessage('Unable to fetch location. Please enable GPS.');
      return;
    }

    setState(() {
      _isCheckingIn = true;
    });

    try {
      await ApiService().checkIn(
        imageFile: File(_selectedImage!.path),
        latitude: _latitude!,
        longitude: _longitude!,
      );
      if (mounted) {
        _showSuccessMessage('Check-in successful');
        setState(() {
          _selectedImage = null;
          _latitude = null;
          _longitude = null;
        });
      }
    } catch (error) {
      _showMessage(error is ApiException ? error.message : 'Check-in failed');
    } finally {
      if (mounted) {
        setState(() {
          _isCheckingIn = false;
        });
      }
    }
  }

  Future<void> _pickCheckoutImageFromCamera() async {
    // Request camera permission
    final hasCameraPermission = await _requestCameraPermission();
    if (!hasCameraPermission) {
      return;
    }

    try {
      final image = await _imagePicker.pickImage(source: ImageSource.camera);
      if (image != null && mounted) {
        setState(() {
          _selectedCheckoutImage = image;
          // Reset checkout location when new image is captured
          _checkoutLatitude = null;
          _checkoutLongitude = null;
        });

        // Automatically fetch GPS location after photo is captured
        await _fetchCheckoutLocation();
      }
    } catch (error) {
      _showMessage('Unable to capture image');
    }
  }

  Future<void> _fetchCheckoutLocation() async {
    setState(() {
      _isFetchingLocation = true;
    });

    try {
      // Request location permission
      final hasPermission = await _requestLocationPermission();
      if (!hasPermission) {
        if (mounted) {
          setState(() {
            _isFetchingLocation = false;
            _checkoutLatitude = null;
            _checkoutLongitude = null;
          });
        }
        return;
      }

      // Try to get last known position first (faster)
      Position? lastKnownPosition;
      try {
        lastKnownPosition = await Geolocator.getLastKnownPosition();
      } catch (e) {
        // Ignore if last known position is not available
      }

      Position position;
      
      // If last known position is available, use it; otherwise get current position
      if (lastKnownPosition != null) {
        position = lastKnownPosition;
      } else {
        try {
          position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.medium,
            timeLimit: const Duration(seconds: 5),
          ).timeout(
            const Duration(seconds: 5),
            onTimeout: () {
              throw TimeoutException('Location fetch timed out');
            },
          );
        } catch (timeoutError) {
          final fallbackPosition = await Geolocator.getLastKnownPosition();
          if (fallbackPosition == null) {
            throw Exception('Unable to get location. Please ensure GPS is enabled.');
          }
          position = fallbackPosition;
        }
      }

      if (mounted) {
        setState(() {
          _checkoutLatitude = position.latitude;
          _checkoutLongitude = position.longitude;
          _isFetchingLocation = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isFetchingLocation = false;
          _checkoutLatitude = null;
          _checkoutLongitude = null;
        });
        final errorMessage = e.toString().contains('timeout') || e.toString().contains('Timeout')
            ? 'Location fetch timed out. Please ensure GPS is enabled and try again.'
            : 'Unable to fetch location. Please enable GPS.';
        _showMessage(errorMessage);
      }
    }
  }

  Future<void> _handleCheckOut() async {
    if (_selectedCheckoutImage == null) {
      _showMessage('Please capture a photo before checking out');
      return;
    }

    if (_checkoutLatitude == null || _checkoutLongitude == null) {
      _showMessage('Unable to fetch location. Please enable GPS.');
      return;
    }

    setState(() {
      _isCheckingOut = true;
    });

    try {
      await ApiService().checkOut(
        imageFile: File(_selectedCheckoutImage!.path),
        latitude: _checkoutLatitude!,
        longitude: _checkoutLongitude!,
      );
      if (mounted) {
        _showSuccessMessage('Check-out successful');
        setState(() {
          _selectedCheckoutImage = null;
          _checkoutLatitude = null;
          _checkoutLongitude = null;
        });
      }
    } catch (error) {
      _showMessage(error is ApiException ? error.message : 'Check-out failed');
    } finally {
      if (mounted) {
        setState(() {
          _isCheckingOut = false;
        });
      }
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppTheme.errorColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }

  void _showSuccessMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppTheme.successColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      appBar: CustomAppBar(
        title: 'Check In / Check Out',
        showBackButton: widget.onBackPressed != null,
        leading: widget.onBackPressed != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back_ios, size: 20),
                onPressed: widget.onBackPressed,
              )
            : null,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              setState(() {
                _selectedImage = null;
                _selectedCheckoutImage = null;
                _latitude = null;
                _longitude = null;
                _checkoutLatitude = null;
                _checkoutLongitude = null;
              });
            },
            tooltip: 'Clear',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Location Display Section
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.location_on,
                          color: AppTheme.primaryColor,
                          size: 24,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Location',
                          style: GoogleFonts.poppins(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    if (_isFetchingLocation)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(16.0),
                          child: Column(
                            children: [
                              CircularProgressIndicator(),
                              SizedBox(height: 12),
                              Text('Fetching GPS location...'),
                            ],
                          ),
                        ),
                      )
                    else if (_latitude != null && _longitude != null)
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.check_circle,
                                  color: AppTheme.successColor,
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Location Captured',
                                  style: GoogleFonts.poppins(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.successColor,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Latitude: ${_latitude!.toStringAsFixed(6)}',
                              style: GoogleFonts.poppins(
                                fontSize: 12,
                                color: AppTheme.textColor,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Longitude: ${_longitude!.toStringAsFixed(6)}',
                              style: GoogleFonts.poppins(
                                fontSize: 12,
                                color: AppTheme.textColor,
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppTheme.backgroundColor,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppTheme.textColor.withOpacity(0.2),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.location_off,
                              color: AppTheme.textColor.withOpacity(0.5),
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Location will be captured automatically after taking a photo',
                                style: GoogleFonts.poppins(
                                  fontSize: 12,
                                  color: AppTheme.textColor.withOpacity(0.7),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            // Image Selection Section
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.image,
                          color: AppTheme.primaryColor,
                          size: 24,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Photo',
                          style: GoogleFonts.poppins(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    if (_selectedImage != null)
                      Container(
                        height: 200,
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          image: DecorationImage(
                            image: FileImage(File(_selectedImage!.path)),
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    CustomButton(
                      onPressed: _pickImageFromCamera,
                      text: 'Camera',
                      icon: Icons.camera_alt,
                      isOutlined: true,
                      width: double.infinity,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
            // Check In Button
            CustomButton(
              onPressed: (_isCheckingIn || _isFetchingLocation) ? null : _handleCheckIn,
              text: 'Check In',
              icon: Icons.login,
              isLoading: _isCheckingIn,
              width: double.infinity,
              height: 56,
            ),
            const SizedBox(height: 24),
            // Check Out Image Selection Section
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.image,
                          color: AppTheme.secondaryColor,
                          size: 24,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Checkout Photo',
                          style: GoogleFonts.poppins(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textColor,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    if (_selectedCheckoutImage != null)
                      Container(
                        height: 200,
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          image: DecorationImage(
                            image: FileImage(File(_selectedCheckoutImage!.path)),
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    if (_checkoutLatitude != null && _checkoutLongitude != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: AppTheme.secondaryColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.check_circle,
                                  color: AppTheme.successColor,
                                  size: 16,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Checkout Location Captured',
                                  style: GoogleFonts.poppins(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.successColor,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Lat: ${_checkoutLatitude!.toStringAsFixed(6)}, Lng: ${_checkoutLongitude!.toStringAsFixed(6)}',
                              style: GoogleFonts.poppins(
                                fontSize: 11,
                                color: AppTheme.textColor,
                              ),
                            ),
                          ],
                        ),
                      ),
                    CustomButton(
                      onPressed: _pickCheckoutImageFromCamera,
                      text: 'Capture Checkout Photo',
                      icon: Icons.camera_alt,
                      isOutlined: true,
                      backgroundColor: AppTheme.secondaryColor,
                      width: double.infinity,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Check Out Button
            CustomButton(
              onPressed: (_isCheckingOut || _isFetchingLocation) ? null : _handleCheckOut,
              text: 'Check Out',
              icon: Icons.logout,
              isLoading: _isCheckingOut,
              backgroundColor: AppTheme.secondaryColor,
              width: double.infinity,
              height: 56,
            ),
            const SizedBox(height: 24),
            // Info Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    color: AppTheme.primaryColor,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Location is automatically captured using GPS after taking a photo. Make sure GPS is enabled.',
                      style: GoogleFonts.poppins(
                        fontSize: 12,
                        color: AppTheme.textColor.withOpacity(0.7),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
