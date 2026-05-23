import requests
import sys

endpoints = [
    "http://localhost:8000/docs",
    "http://localhost:8000/openapi.json"
]

print("Testing Endpoints with 5-second timeout...")
print()

for i, endpoint in enumerate(endpoints, 1):
    print(f"{i}. Testing: {endpoint}")
    try:
        response = requests.get(endpoint, timeout=5)
        print(f"   ✓ RESPONDS - Status Code: {response.status_code}")
    except requests.exceptions.Timeout:
        print(f"   ✗ TIMEOUT (5 seconds)")
    except requests.exceptions.ConnectionError as e:
        print(f"   ✗ CONNECTION ERROR: Cannot connect to server")
    except Exception as e:
        print(f"   ✗ ERROR: {type(e).__name__}: {str(e)}")
    print()

print("Test Complete")
