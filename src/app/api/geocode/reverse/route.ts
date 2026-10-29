import { NextResponse } from 'next/server';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';

export async function GET(request: Request) {
  try {
    // OpenStreetMap's lookup allows about one request a second, so each caller gets a small budget
    if (!checkRateLimit(`geocode:${clientIp(request)}`, 20, 60_000).allowed) {
      return NextResponse.json({ error: 'Too many location lookups. Try again in a minute.' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json({ error: 'lat and lng parameters are required.' }, { status: 400 });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 });
    }

    // Call Nominatim reverse geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          // Nominatim's usage policy asks for an identifying app name and a way to reach the app
          'User-Agent': `KupKop-StreetAnimalNetwork/1.0 (+${new URL(request.url).origin})`,
          'Accept-Language': 'en',
        },
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      return NextResponse.json({
        address: `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`,
        city: 'Metro Manila',
      });
    }

    const data = await response.json();
    const addr = data.address || {};

    const street =
      addr.road ||
      addr.pedestrian ||
      addr.suburb ||
      addr.neighbourhood ||
      addr.quarter ||
      '';

    const city =
      addr.city ||
      addr.town ||
      addr.municipality ||
      addr.city_district ||
      addr.state ||
      'Metro Manila';

    const formatted = street ? `${street}, ${city}` : data.display_name?.split(',').slice(0, 3).join(',') || `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;

    return NextResponse.json({
      formatted,
      street,
      city,
      fullAddress: data.display_name,
      lat: latitude,
      lng: longitude,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Reverse geocoding error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
