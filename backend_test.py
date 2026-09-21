#!/usr/bin/env python3
"""
Backend API Test for Konter HP - ESC/POS Receipt Endpoints
Tests ONLY the new ESC/POS receipt generation endpoints
"""

import requests
import json
import base64
import sys

# Configuration
BASE_URL = "https://phone-counter-1.preview.emergentagent.com/api"
EMAIL = "ponselyen@gmail.com"
PASSWORD = "Meranti123"

# Global token storage
token = None

def print_test(name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")
    print()

def login():
    """Login and get auth token"""
    global token
    print("=" * 60)
    print("AUTHENTICATION")
    print("=" * 60)
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token")
            print_test("Login successful", True, f"Token received: {token[:20]}...")
            return True
        else:
            print_test("Login failed", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        print_test("Login exception", False, str(e))
        return False

def get_headers(include_auth=True):
    """Get request headers"""
    headers = {"Content-Type": "application/json"}
    if include_auth and token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

def get_or_create_service():
    """Get existing service or create one with items"""
    print("=" * 60)
    print("SERVICE SETUP")
    print("=" * 60)
    
    try:
        # Try to get existing services
        response = requests.get(f"{BASE_URL}/services", headers=get_headers(), timeout=10)
        if response.status_code == 200:
            services = response.json()
            if services and len(services) > 0:
                service_id = services[0].get("id")
                service_number = services[0].get("serviceNumber", "N/A")
                print_test("Found existing service", True, f"ID: {service_id}, Number: {service_number}")
                return service_id
        
        # Create new service
        print("No services found, creating new service...")
        service_data = {
            "customerName": "Print Test Customer",
            "customerPhone": "081234567890",
            "brand": "Samsung",
            "model": "Galaxy A10",
            "complaint": "LCD rusak perlu diganti"
        }
        
        response = requests.post(
            f"{BASE_URL}/services",
            headers=get_headers(),
            json=service_data,
            timeout=10
        )
        
        if response.status_code != 200:
            print_test("Service creation failed", False, f"Status: {response.status_code}, Response: {response.text}")
            return None
        
        service = response.json()
        service_id = service.get("id")
        service_number = service.get("serviceNumber", "N/A")
        print_test("Service created", True, f"ID: {service_id}, Number: {service_number}")
        
        # Add item to service
        item_data = {
            "description": "Ganti LCD Samsung A10",
            "qty": 1,
            "servicePrice": 100000,
            "sparepartPrice": 0,
            "sparepartName": "",
            "inventoryId": None
        }
        
        response = requests.post(
            f"{BASE_URL}/services/{service_id}/items",
            headers=get_headers(),
            json=item_data,
            timeout=10
        )
        
        if response.status_code == 200:
            print_test("Item added to service", True, "Service price: Rp100,000")
        else:
            print_test("Item addition failed", False, f"Status: {response.status_code}")
        
        return service_id
        
    except Exception as e:
        print_test("Service setup exception", False, str(e))
        return None

def get_or_create_sale():
    """Get existing sale or create one"""
    print("=" * 60)
    print("SALE SETUP")
    print("=" * 60)
    
    try:
        # Try to get existing sales
        response = requests.get(f"{BASE_URL}/sales", headers=get_headers(), timeout=10)
        if response.status_code == 200:
            sales = response.json()
            if sales and len(sales) > 0:
                sale_id = sales[0].get("id")
                sale_number = sales[0].get("saleNumber", "N/A")
                print_test("Found existing sale", True, f"ID: {sale_id}, Number: {sale_number}")
                return sale_id
        
        # Need to create sale - first get inventory with stock
        print("No sales found, creating new sale...")
        response = requests.get(f"{BASE_URL}/inventory", headers=get_headers(), timeout=10)
        
        if response.status_code != 200:
            print_test("Inventory fetch failed", False, f"Status: {response.status_code}")
            return None
        
        inventory = response.json()
        available_items = [item for item in inventory if item.get("stock", 0) > 0]
        
        if not available_items:
            print_test("No inventory with stock", False, "Cannot create sale without inventory")
            return None
        
        # Use first available item
        item = available_items[0]
        sale_data = {
            "items": [{
                "inventoryId": item.get("id"),
                "name": item.get("name"),
                "qty": 1,
                "price": item.get("sellPrice", 10000)
            }]
        }
        
        response = requests.post(
            f"{BASE_URL}/sales",
            headers=get_headers(),
            json=sale_data,
            timeout=10
        )
        
        if response.status_code != 200:
            print_test("Sale creation failed", False, f"Status: {response.status_code}, Response: {response.text}")
            return None
        
        sale = response.json()
        sale_id = sale.get("id")
        sale_number = sale.get("saleNumber", "N/A")
        print_test("Sale created", True, f"ID: {sale_id}, Number: {sale_number}")
        return sale_id
        
    except Exception as e:
        print_test("Sale setup exception", False, str(e))
        return None

def verify_escpos_bytes(base64_str, expected_length):
    """Verify ESC/POS byte structure"""
    try:
        decoded = base64.b64decode(base64_str)
        actual_length = len(decoded)
        
        # Check length matches
        if actual_length != expected_length:
            return False, f"Length mismatch: expected {expected_length}, got {actual_length}"
        
        # Check first two bytes: 0x1B 0x40 (ESC @)
        if len(decoded) < 2 or decoded[0] != 0x1B or decoded[1] != 0x40:
            return False, f"Invalid start bytes: expected 1B 40, got {decoded[0]:02X} {decoded[1]:02X}"
        
        # Check last four bytes: 0x1D 0x56 0x42 0x00 (GS V B 0 - cut)
        if len(decoded) < 4:
            return False, "Bytes too short for cut command"
        
        last_four = decoded[-4:]
        if last_four[0] != 0x1D or last_four[1] != 0x56 or last_four[2] != 0x42 or last_four[3] != 0x00:
            return False, f"Invalid end bytes: expected 1D 56 42 00, got {last_four[0]:02X} {last_four[1]:02X} {last_four[2]:02X} {last_four[3]:02X}"
        
        return True, "Byte structure valid"
        
    except Exception as e:
        return False, f"Decode error: {str(e)}"

def verify_preview_lines(preview, max_chars, required_texts):
    """Verify preview line lengths and required content"""
    lines = preview.split('\n')
    
    # Check line lengths
    for i, line in enumerate(lines):
        if len(line) > max_chars:
            return False, f"Line {i+1} exceeds {max_chars} chars: '{line}' ({len(line)} chars)"
    
    # Check required texts
    preview_lower = preview.lower()
    for text in required_texts:
        if text.lower() not in preview_lower:
            return False, f"Missing required text: '{text}'"
    
    return True, f"All lines <= {max_chars} chars, all required texts present"

def test_service_escpos_58mm(service_id, service_number):
    """Test GET /api/services/:id/escpos?width=58"""
    print("=" * 60)
    print("TEST: Service ESC/POS 58mm (32 columns)")
    print("=" * 60)
    
    try:
        response = requests.get(
            f"{BASE_URL}/services/{service_id}/escpos?width=58",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code != 200:
            print_test("Service ESC/POS 58mm", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check response structure
        if "width" not in data or "length" not in data or "base64" not in data or "preview" not in data:
            print_test("Service ESC/POS 58mm", False, "Missing required fields in response")
            return False
        
        # Check width
        if data["width"] != "58":
            print_test("Service ESC/POS 58mm - width", False, f"Expected '58', got '{data['width']}'")
            return False
        
        print_test("Service ESC/POS 58mm - width", True, "Width is '58'")
        
        # Check length
        if data["length"] <= 0:
            print_test("Service ESC/POS 58mm - length", False, f"Length must be > 0, got {data['length']}")
            return False
        
        print_test("Service ESC/POS 58mm - length", True, f"Length: {data['length']} bytes")
        
        # Verify bytes
        valid, msg = verify_escpos_bytes(data["base64"], data["length"])
        print_test("Service ESC/POS 58mm - byte structure", valid, msg)
        
        if not valid:
            return False
        
        # Verify preview
        required_texts = [service_number, "NOTA SERVICE", "TOTAL"]
        valid, msg = verify_preview_lines(data["preview"], 32, required_texts)
        print_test("Service ESC/POS 58mm - preview", valid, msg)
        
        if valid:
            print("Sample preview (first 500 chars):")
            print("-" * 40)
            print(data["preview"][:500])
            print("-" * 40)
            print()
        
        return valid
        
    except Exception as e:
        print_test("Service ESC/POS 58mm - exception", False, str(e))
        return False

def test_service_escpos_80mm(service_id, service_number):
    """Test GET /api/services/:id/escpos?width=80"""
    print("=" * 60)
    print("TEST: Service ESC/POS 80mm (48 columns)")
    print("=" * 60)
    
    try:
        response = requests.get(
            f"{BASE_URL}/services/{service_id}/escpos?width=80",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code != 200:
            print_test("Service ESC/POS 80mm", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check width
        if data["width"] != "80":
            print_test("Service ESC/POS 80mm - width", False, f"Expected '80', got '{data['width']}'")
            return False
        
        print_test("Service ESC/POS 80mm - width", True, "Width is '80'")
        
        # Verify preview line lengths (48 chars max for 80mm)
        required_texts = [service_number, "NOTA SERVICE", "TOTAL"]
        valid, msg = verify_preview_lines(data["preview"], 48, required_texts)
        print_test("Service ESC/POS 80mm - preview", valid, msg)
        
        return valid
        
    except Exception as e:
        print_test("Service ESC/POS 80mm - exception", False, str(e))
        return False

def test_service_escpos_invalid_width(service_id):
    """Test GET /api/services/:id/escpos?width=100 (should fallback to 58)"""
    print("=" * 60)
    print("TEST: Service ESC/POS Invalid Width (fallback to 58)")
    print("=" * 60)
    
    try:
        response = requests.get(
            f"{BASE_URL}/services/{service_id}/escpos?width=100",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code != 200:
            print_test("Service ESC/POS invalid width", False, f"Status: {response.status_code}")
            return False
        
        data = response.json()
        
        # Should fallback to 58
        if data["width"] != "58":
            print_test("Service ESC/POS invalid width", False, f"Expected fallback to '58', got '{data['width']}'")
            return False
        
        print_test("Service ESC/POS invalid width", True, "Correctly fell back to '58'")
        return True
        
    except Exception as e:
        print_test("Service ESC/POS invalid width - exception", False, str(e))
        return False

def test_sale_escpos_58mm(sale_id, sale_number):
    """Test GET /api/sales/:id/escpos?width=58"""
    print("=" * 60)
    print("TEST: Sale ESC/POS 58mm")
    print("=" * 60)
    
    try:
        response = requests.get(
            f"{BASE_URL}/sales/{sale_id}/escpos?width=58",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code != 200:
            print_test("Sale ESC/POS 58mm", False, f"Status: {response.status_code}, Response: {response.text}")
            return False
        
        data = response.json()
        
        # Check response structure
        if "width" not in data or "length" not in data or "base64" not in data or "preview" not in data:
            print_test("Sale ESC/POS 58mm", False, "Missing required fields in response")
            return False
        
        # Check width
        if data["width"] != "58":
            print_test("Sale ESC/POS 58mm - width", False, f"Expected '58', got '{data['width']}'")
            return False
        
        print_test("Sale ESC/POS 58mm - width", True, "Width is '58'")
        
        # Verify bytes
        valid, msg = verify_escpos_bytes(data["base64"], data["length"])
        print_test("Sale ESC/POS 58mm - byte structure", valid, msg)
        
        if not valid:
            return False
        
        # Verify preview
        required_texts = [sale_number, "NOTA PENJUALAN", "TOTAL"]
        valid, msg = verify_preview_lines(data["preview"], 32, required_texts)
        print_test("Sale ESC/POS 58mm - preview", valid, msg)
        
        if valid:
            print("Sample preview (first 500 chars):")
            print("-" * 40)
            print(data["preview"][:500])
            print("-" * 40)
            print()
        
        return valid
        
    except Exception as e:
        print_test("Sale ESC/POS 58mm - exception", False, str(e))
        return False

def test_escpos_not_found():
    """Test GET /api/services/nonexistent-id/escpos -> 404"""
    print("=" * 60)
    print("TEST: ESC/POS Not Found (404)")
    print("=" * 60)
    
    try:
        # Test service endpoint
        response = requests.get(
            f"{BASE_URL}/services/nonexistent-id-12345/escpos?width=58",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code != 404:
            print_test("Service ESC/POS 404", False, f"Expected 404, got {response.status_code}")
            return False
        
        print_test("Service ESC/POS 404", True, "Correctly returned 404 for non-existent service")
        
        # Test sale endpoint
        response = requests.get(
            f"{BASE_URL}/sales/nonexistent-id-12345/escpos?width=58",
            headers=get_headers(),
            timeout=10
        )
        
        if response.status_code != 404:
            print_test("Sale ESC/POS 404", False, f"Expected 404, got {response.status_code}")
            return False
        
        print_test("Sale ESC/POS 404", True, "Correctly returned 404 for non-existent sale")
        return True
        
    except Exception as e:
        print_test("ESC/POS 404 - exception", False, str(e))
        return False

def test_escpos_unauthorized(service_id):
    """Test GET /api/services/:id/escpos without Authorization -> 401"""
    print("=" * 60)
    print("TEST: ESC/POS Unauthorized (401)")
    print("=" * 60)
    
    try:
        response = requests.get(
            f"{BASE_URL}/services/{service_id}/escpos?width=58",
            headers={"Content-Type": "application/json"},  # No auth header
            timeout=10
        )
        
        if response.status_code != 401:
            print_test("ESC/POS 401", False, f"Expected 401, got {response.status_code}")
            return False
        
        print_test("ESC/POS 401", True, "Correctly returned 401 without auth token")
        return True
        
    except Exception as e:
        print_test("ESC/POS 401 - exception", False, str(e))
        return False

def main():
    """Main test runner"""
    print("\n" + "=" * 60)
    print("KONTER HP - ESC/POS RECEIPT ENDPOINTS TEST")
    print("=" * 60)
    print()
    
    # Login
    if not login():
        print("\n❌ FATAL: Login failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Setup service
    service_id = get_or_create_service()
    if not service_id:
        print("\n❌ FATAL: Could not get/create service. Cannot proceed with tests.")
        sys.exit(1)
    
    # Get service number for verification
    try:
        response = requests.get(f"{BASE_URL}/services/{service_id}", headers=get_headers(), timeout=10)
        service_number = response.json().get("serviceNumber", "UNKNOWN")
    except:
        service_number = "UNKNOWN"
    
    # Setup sale
    sale_id = get_or_create_sale()
    if not sale_id:
        print("\n⚠️  WARNING: Could not get/create sale. Skipping sale tests.")
        sale_number = None
    else:
        # Get sale number for verification
        try:
            response = requests.get(f"{BASE_URL}/sales", headers=get_headers(), timeout=10)
            sales = response.json()
            sale = next((s for s in sales if s.get("id") == sale_id), None)
            sale_number = sale.get("saleNumber", "UNKNOWN") if sale else "UNKNOWN"
        except:
            sale_number = "UNKNOWN"
    
    # Run tests
    results = []
    
    # Service ESC/POS tests
    results.append(("Service ESC/POS 58mm", test_service_escpos_58mm(service_id, service_number)))
    results.append(("Service ESC/POS 80mm", test_service_escpos_80mm(service_id, service_number)))
    results.append(("Service ESC/POS invalid width fallback", test_service_escpos_invalid_width(service_id)))
    
    # Sale ESC/POS tests
    if sale_id:
        results.append(("Sale ESC/POS 58mm", test_sale_escpos_58mm(sale_id, sale_number)))
    
    # Error handling tests
    results.append(("ESC/POS 404 handling", test_escpos_not_found()))
    results.append(("ESC/POS 401 handling", test_escpos_unauthorized(service_id)))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print()
    print(f"Total: {passed}/{total} tests passed ({passed*100//total}%)")
    print("=" * 60)
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} TEST(S) FAILED")
        sys.exit(1)

if __name__ == "__main__":
    main()
