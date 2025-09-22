import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth'

export async function GET() {
  try {
    // Get all users for testing
    const hdUsers = await AuthService.getHDUsers()
    const technicians = await AuthService.getTechnicians()
    
    return NextResponse.json({
      success: true,
      data: {
        hd_users: hdUsers,
        technicians: technicians,
        total_users: hdUsers.length + technicians.length
      }
    })
  } catch (error) {
    console.error('Error getting users:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get users'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telegram_id, username, full_name, role, phone } = body
    
    // Validate required fields
    if (!telegram_id || !full_name || !role) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: telegram_id, full_name, role'
      }, { status: 400 })
    }
    
    // Validate role
    if (!['HD', 'TEKNISI'].includes(role)) {
      return NextResponse.json({
        success: false,
        error: 'Role must be HD or TEKNISI'
      }, { status: 400 })
    }
    
    // Check if user already exists
    const existingUser = await AuthService.getUserByTelegramId(telegram_id)
    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'User already exists'
      }, { status: 409 })
    }
    
    // Register user
    const newUser = await AuthService.registerUser({
      telegram_id,
      username,
      full_name,
      role,
      phone
    })
    
    if (newUser) {
      return NextResponse.json({
        success: true,
        data: newUser,
        message: 'User registered successfully'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to register user'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error registering user:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}