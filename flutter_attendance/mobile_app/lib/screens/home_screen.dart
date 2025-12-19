import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../services/api_service.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.userEmail});

  final String userEmail;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _latController = TextEditingController();
  final _longController = TextEditingController();
  final _imagePicker = ImagePicker();

  bool _isCheckingIn = false;
  bool _isCheckingOut = false;
  bool _isRefreshing = false;
  XFile? _selectedImage;
  List<dynamic> _records = const [];

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _latController.dispose();
    _longController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    setState(() {
      _isRefreshing = true;
    });
    try {
      final records = await ApiService().fetchMyAttendance();
      if (mounted) {
        setState(() {
          _records = records;
        });
      }
    } catch (error) {
      _showMessage(error is ApiException ? error.message : 'Failed to load records');
    } finally {
      if (mounted) {
        setState(() {
          _isRefreshing = false;
        });
      }
    }
  }

  Future<void> _pickImage() async {
    try {
      final image = await _imagePicker.pickImage(source: ImageSource.gallery);
      if (image != null) {
        setState(() {
          _selectedImage = image;
        });
      }
    } catch (error) {
      _showMessage('Unable to select image');
    }
  }

  Future<void> _handleCheckIn() async {
    final lat = double.tryParse(_latController.text.trim());
    final long = double.tryParse(_longController.text.trim());

    if (_selectedImage == null) {
      _showMessage('Please select an image before checking in');
      return;
    }
    if (lat == null || long == null) {
      _showMessage('Please provide valid latitude and longitude');
      return;
    }

    setState(() {
      _isCheckingIn = true;
    });

    try {
      await ApiService().checkIn(
        imageFile: File(_selectedImage!.path),
        latitude: lat,
        longitude: long,
      );
      _showMessage('Check-in successful');
      setState(() {
        _selectedImage = null;
      });
      _latController.clear();
      _longController.clear();
      await _loadInitialData();
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

  Future<void> _handleCheckOut() async {
    // Note: This screen is deprecated. Check-out should be done through CheckInOutScreen
    // which requires photo capture. This method is kept for backward compatibility.
    _showMessage('Please use the Check In/Out screen to check out. Photo capture is required.');
  }

  Future<void> _handleLogout() async {
    await ApiService().clearSession();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Widget _buildRecordTile(dynamic record) {
    if (record is! Map<String, dynamic>) {
      return const SizedBox.shrink();
    }

    final checkIn = record['check_in_time']?.toString() ?? 'N/A';
    final checkOut = record['check_out_time']?.toString() ?? 'Active';
    final imageUrl = record['image_url']?.toString();
    final latitude = record['latitude']?.toString() ?? '-';
    final longitude = record['longitude']?.toString() ?? '-';

    return Card(
      child: ListTile(
        title: Text('Checked in: $checkIn'),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Checked out: $checkOut'),
            Text('Lat: $latitude | Long: $longitude'),
            if (imageUrl != null && imageUrl.isNotEmpty) Text('Image: $imageUrl'),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance Home'),
        actions: [
          IconButton(
            onPressed: _isRefreshing ? null : _loadInitialData,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            onPressed: _handleLogout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (widget.userEmail.isNotEmpty)
              Text(
                'Logged in as ${widget.userEmail}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _latController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Latitude',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _longController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                      labelText: 'Longitude',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _pickImage,
                    icon: const Icon(Icons.photo_library),
                    label: const Text('Select Image'),
                  ),
                ),
                const SizedBox(width: 12),
                if (_selectedImage != null)
                  Expanded(
                    child: Text(
                      'Selected: ${_selectedImage!.name}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isCheckingIn ? null : _handleCheckIn,
                child: _isCheckingIn
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Check In'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isCheckingOut ? null : _handleCheckOut,
                child: _isCheckingOut
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Check Out'),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'My Attendance',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            if (_isRefreshing)
              const Center(child: CircularProgressIndicator())
            else if (_records.isEmpty)
              const Text('No attendance records found.')
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _records.length,
                itemBuilder: (context, index) => _buildRecordTile(_records[index]),
              ),
          ],
        ),
      ),
    );
  }
}

