import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, password, companyName, contactPerson, address } = body;

    // Validation
    if (!name || !email || !password || !companyName) {
      return NextResponse.json(
        { message: 'Name, email, password, and company name are required' },
        { status: 400 }
      );
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { message: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    // Password validation
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json(
        { message: 'Password must be between 8 and 128 characters' },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(password)) {
      return NextResponse.json(
        { message: 'Password must contain at least one uppercase letter' },
        { status: 400 }
      );
    }

    if (!/[a-z]/.test(password)) {
      return NextResponse.json(
        { message: 'Password must contain at least one lowercase letter' },
        { status: 400 }
      );
    }

    if (!/[0-9]/.test(password)) {
      return NextResponse.json(
        { message: 'Password must contain at least one number' },
        { status: 400 }
      );
    }

    if (!/[!@#$%^&*]/.test(password)) {
      return NextResponse.json(
        { message: 'Password must contain at least one special character (!@#$%^&*)' },
        { status: 400 }
      );
    }

    // Phone validation (if provided)
    if (phone) {
      const phoneRegex = /^[0-9\s\-\+\(\)]{8,13}$/;
      const digitsOnly = phone.replace(/[^0-9]/g, '');
      if (!phoneRegex.test(phone) || digitsOnly.length < 8 || digitsOnly.length > 13) {
        return NextResponse.json(
          { message: 'Phone number must be 8-13 digits (Singapore: 8 digits)' },
          { status: 400 }
        );
      }
    }

    // Call backend API to create client
    const response = await fetch(`${API_BASE_URL}/api/client/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        password,
        companyName: companyName.trim(),
        contactPerson: contactPerson?.trim() || name.trim(),
        address: address?.trim() || null,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Signup failed' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      message: 'Account created successfully. Please log in.',
      success: true,
    });
  } catch (error: any) {
    console.error('Client signup error:', error);
    return NextResponse.json(
      { message: error.message || 'Signup failed' },
      { status: 500 }
    );
  }
}

