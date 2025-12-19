import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'dart:typed_data';
import 'package:flutter/rendering.dart';
import 'dart:convert';

class SignaturePad extends StatefulWidget {
  final Function(String) onSignatureSaved;
  final bool enabled;

  const SignaturePad({
    super.key,
    required this.onSignatureSaved,
    this.enabled = true,
  });

  @override
  State<SignaturePad> createState() => _SignaturePadState();
}

class _SignaturePadState extends State<SignaturePad> {
  List<Offset> _points = [];
  final GlobalKey _repaintBoundaryKey = GlobalKey();
  final GlobalKey _containerKey = GlobalKey();
  bool _isDrawing = false;

  bool _isWithinBounds(Offset position) {
    final RenderBox? renderBox = _containerKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox == null) return false;
    
    final size = renderBox.size;
    return position.dx >= 0 && 
           position.dx <= size.width && 
           position.dy >= 0 && 
           position.dy <= size.height;
  }

  void _onPanStart(DragStartDetails details) {
    if (!widget.enabled) return;
    
    // Check if touch is within bounds
    if (!_isWithinBounds(details.localPosition)) {
      return;
    }
    
    _isDrawing = true;
    setState(() {
      _points.add(details.localPosition);
    });
  }

  void _onPanUpdate(DragUpdateDetails details) {
    if (!widget.enabled || !_isDrawing) return;
    
    // Check if touch is within bounds
    if (!_isWithinBounds(details.localPosition)) {
      // If moved outside, end the stroke
      setState(() {
        _points.add(Offset.zero); // Marker to indicate end of stroke
        _isDrawing = false;
      });
      return;
    }
    
    setState(() {
      _points.add(details.localPosition);
    });
  }

  void _onPanEnd(DragEndDetails details) {
    if (!widget.enabled || !_isDrawing) return;
    
    setState(() {
      _points.add(Offset.zero); // Marker to indicate end of stroke
      _isDrawing = false;
    });
  }

  void _clearSignature() {
    setState(() {
      _points.clear();
    });
  }

  Future<void> _saveSignature() async {
    if (_points.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please provide a signature')),
      );
      return;
    }

    try {
      final RenderRepaintBoundary boundary =
          _repaintBoundaryKey.currentContext!.findRenderObject()
              as RenderRepaintBoundary;
      final ui.Image image = await boundary.toImage(pixelRatio: 3.0);
      final ByteData? byteData =
          await image.toByteData(format: ui.ImageByteFormat.png);
      final Uint8List pngBytes = byteData!.buffer.asUint8List();
      final String base64String = base64Encode(pngBytes);
      final String dataUri = 'data:image/png;base64,$base64String';

      widget.onSignatureSaved(dataUri);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error saving signature: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Wrap in NotificationListener to prevent scroll when touching signature pad
        NotificationListener<ScrollNotification>(
          onNotification: (notification) {
            // Prevent scroll notifications from propagating when touching signature pad
            return true;
          },
          child: Container(
            key: _containerKey,
            height: 200,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade300, width: 2),
              borderRadius: BorderRadius.circular(8),
              color: Colors.white,
            ),
            child: GestureDetector(
              // Absorb all gestures to prevent scroll interference
              onVerticalDragStart: (_) {},
              onVerticalDragUpdate: (_) {},
              onVerticalDragEnd: (_) {},
              onVerticalDragCancel: () {},
              child: Stack(
                children: [
                  RepaintBoundary(
                    key: _repaintBoundaryKey,
                    child: GestureDetector(
                      onPanStart: (details) {
                        // Only start drawing if within bounds
                        _onPanStart(details);
                      },
                      onPanUpdate: (details) {
                        // Only continue drawing if within bounds
                        _onPanUpdate(details);
                      },
                      onPanEnd: (details) {
                        _onPanEnd(details);
                      },
                      behavior: HitTestBehavior.deferToChild,
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          return CustomPaint(
                            painter: SignaturePainter(_points),
                            size: Size(constraints.maxWidth, constraints.maxHeight),
                          );
                        },
                      ),
                    ),
                  ),
                  // Placeholder text when no signature
                  if (_points.isEmpty)
                    Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.edit,
                            size: 48,
                            color: Colors.grey.shade400,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Draw your signature here',
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.grey.shade500,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Touch and drag to sign',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade400,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: ElevatedButton.icon(
                onPressed: widget.enabled ? _clearSignature : null,
                icon: const Icon(Icons.clear, size: 18),
                label: const Text('Clear'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey.shade300,
                  foregroundColor: Colors.black87,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: widget.enabled ? _saveSignature : null,
                icon: const Icon(Icons.check, size: 18),
                label: const Text('Save'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class SignaturePainter extends CustomPainter {
  final List<Offset> points;

  SignaturePainter(this.points);

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = Colors.black
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3.0;

    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != Offset.zero && points[i + 1] != Offset.zero) {
        canvas.drawLine(points[i], points[i + 1], paint);
      }
    }
  }

  @override
  bool shouldRepaint(SignaturePainter oldDelegate) =>
      oldDelegate.points != points;
}

