#!/usr/bin/env python3
"""
Comprehensive backend API test for Konter HP application.
Tests all endpoints with focus on stock integrity.
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://phone-counter-1.preview.emergentagent.com/api"
LOGIN_EMAIL = "ponselyen@gmail.com"
LOGIN_PASSWORD = "Meranti123"

# Global variables
token = None
headers = {}

def print_test(name, passed, details=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   Details: {details}")
    if not passed:
        print()

def test_auth_login_success():
    """Test POST /api/auth/login with correct credentials"""
    global token, headers
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": LOGIN_EMAIL,
            "password": LOGIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                token = data["token"]
                headers = {"Authorization": f"Bearer {token}"}
                print_test("Auth: Login with correct credentials", True, f"Token received, user: {data['user']['email']}")
                return True
            else:
                print_test("Auth: Login with correct credentials", False, "Response missing token or user")
                return False
        else:
            print_test("Auth: Login with correct credentials", False, f"Status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_test("Auth: Login with correct credentials", False, f"Exception: {str(e)}")
        return False

def test_auth_login_wrong_password():
    """Test POST /api/auth/login with wrong password"""
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": LOGIN_EMAIL,
            "password": "wrongpassword123"
        })
        
        if response.status_code == 401:
            print_test("Auth: Login with wrong password returns 401", True)
            return True
        else:
            print_test("Auth: Login with wrong password returns 401", False, f"Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print_test("Auth: Login with wrong password returns 401", False, f"Exception: {str(e)}")
        return False

def test_auth_me_with_token():
    """Test GET /api/auth/me with token"""
    try:
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if "user" in data and data["user"]["email"] == LOGIN_EMAIL:
                print_test("Auth: GET /auth/me with token", True, f"User: {data['user']['email']}")
                return True
            else:
                print_test("Auth: GET /auth/me with token", False, "Invalid user data")
                return False
        else:
            print_test("Auth: GET /auth/me with token", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Auth: GET /auth/me with token", False, f"Exception: {str(e)}")
        return False

def test_auth_me_without_token():
    """Test GET /api/auth/me without token"""
    try:
        response = requests.get(f"{BASE_URL}/auth/me")
        
        if response.status_code == 401:
            print_test("Auth: GET /auth/me without token returns 401", True)
            return True
        else:
            print_test("Auth: GET /auth/me without token returns 401", False, f"Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print_test("Auth: GET /auth/me without token returns 401", False, f"Exception: {str(e)}")
        return False

def test_inventory_create():
    """Test POST /api/inventory - create item with initial stock"""
    try:
        response = requests.post(f"{BASE_URL}/inventory", headers=headers, json={
            "name": "Test LCD Samsung A10",
            "category": "LCD",
            "stock": 5,
            "minStock": 2,
            "buyPrice": 300000,
            "sellPrice": 400000,
            "location": "TEST-01"
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get("stock") == 5 and data.get("name") == "Test LCD Samsung A10":
                # Verify movement was created
                inv_id = data["id"]
                detail_response = requests.get(f"{BASE_URL}/inventory/{inv_id}", headers=headers)
                if detail_response.status_code == 200:
                    detail = detail_response.json()
                    movements = detail.get("movements", [])
                    stok_awal = any(m.get("type") == "STOK_AWAL" for m in movements)
                    if stok_awal:
                        print_test("Inventory: Create item with STOK_AWAL movement", True, f"ID: {inv_id}, Stock: 5")
                        return True, inv_id
                    else:
                        print_test("Inventory: Create item with STOK_AWAL movement", False, "STOK_AWAL movement not found")
                        return False, inv_id
                else:
                    print_test("Inventory: Create item with STOK_AWAL movement", False, "Could not fetch item details")
                    return False, inv_id
            else:
                print_test("Inventory: Create item with STOK_AWAL movement", False, "Invalid item data")
                return False, None
        else:
            print_test("Inventory: Create item with STOK_AWAL movement", False, f"Status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_test("Inventory: Create item with STOK_AWAL movement", False, f"Exception: {str(e)}")
        return False, None

def test_inventory_list():
    """Test GET /api/inventory"""
    try:
        response = requests.get(f"{BASE_URL}/inventory", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print_test("Inventory: GET list", True, f"Found {len(data)} items")
                return True
            else:
                print_test("Inventory: GET list", False, "Response is not a list")
                return False
        else:
            print_test("Inventory: GET list", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Inventory: GET list", False, f"Exception: {str(e)}")
        return False

def test_inventory_adjust_masuk(inv_id):
    """Test POST /api/inventory/:id/adjust with STOK_MASUK"""
    try:
        # Get current stock
        detail_response = requests.get(f"{BASE_URL}/inventory/{inv_id}", headers=headers)
        if detail_response.status_code != 200:
            print_test("Inventory: Adjust STOK_MASUK", False, "Could not fetch current stock")
            return False
        
        current_stock = detail_response.json().get("stock", 0)
        
        # Add stock
        response = requests.post(f"{BASE_URL}/inventory/{inv_id}/adjust", headers=headers, json={
            "type": "STOK_MASUK",
            "qty": 3,
            "note": "Test stock in"
        })
        
        if response.status_code == 200:
            data = response.json()
            new_stock = data.get("stock", 0)
            if new_stock == current_stock + 3:
                print_test("Inventory: Adjust STOK_MASUK", True, f"Stock increased from {current_stock} to {new_stock}")
                return True
            else:
                print_test("Inventory: Adjust STOK_MASUK", False, f"Expected {current_stock + 3}, got {new_stock}")
                return False
        else:
            print_test("Inventory: Adjust STOK_MASUK", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Inventory: Adjust STOK_MASUK", False, f"Exception: {str(e)}")
        return False

def test_inventory_adjust_keluar(inv_id):
    """Test POST /api/inventory/:id/adjust with STOK_KELUAR"""
    try:
        # Get current stock
        detail_response = requests.get(f"{BASE_URL}/inventory/{inv_id}", headers=headers)
        if detail_response.status_code != 200:
            print_test("Inventory: Adjust STOK_KELUAR", False, "Could not fetch current stock")
            return False
        
        current_stock = detail_response.json().get("stock", 0)
        
        # Remove stock
        response = requests.post(f"{BASE_URL}/inventory/{inv_id}/adjust", headers=headers, json={
            "type": "STOK_KELUAR",
            "qty": 2,
            "note": "Test stock out"
        })
        
        if response.status_code == 200:
            data = response.json()
            new_stock = data.get("stock", 0)
            if new_stock == current_stock - 2:
                print_test("Inventory: Adjust STOK_KELUAR", True, f"Stock decreased from {current_stock} to {new_stock}")
                return True
            else:
                print_test("Inventory: Adjust STOK_KELUAR", False, f"Expected {current_stock - 2}, got {new_stock}")
                return False
        else:
            print_test("Inventory: Adjust STOK_KELUAR", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Inventory: Adjust STOK_KELUAR", False, f"Exception: {str(e)}")
        return False

def test_inventory_adjust_penyesuaian(inv_id):
    """Test POST /api/inventory/:id/adjust with PENYESUAIAN"""
    try:
        response = requests.post(f"{BASE_URL}/inventory/{inv_id}/adjust", headers=headers, json={
            "type": "PENYESUAIAN",
            "setTo": 10,
            "note": "Test adjustment"
        })
        
        if response.status_code == 200:
            data = response.json()
            new_stock = data.get("stock", 0)
            if new_stock == 10:
                print_test("Inventory: Adjust PENYESUAIAN", True, f"Stock set to 10")
                return True
            else:
                print_test("Inventory: Adjust PENYESUAIAN", False, f"Expected 10, got {new_stock}")
                return False
        else:
            print_test("Inventory: Adjust PENYESUAIAN", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Inventory: Adjust PENYESUAIAN", False, f"Exception: {str(e)}")
        return False

def test_inventory_negative_stock_rejection(inv_id):
    """Test that negative stock is rejected"""
    try:
        response = requests.post(f"{BASE_URL}/inventory/{inv_id}/adjust", headers=headers, json={
            "type": "STOK_KELUAR",
            "qty": 1000,
            "note": "Test negative rejection"
        })
        
        if response.status_code == 400:
            print_test("Inventory: Negative stock rejection", True, "400 error returned as expected")
            return True
        else:
            print_test("Inventory: Negative stock rejection", False, f"Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        print_test("Inventory: Negative stock rejection", False, f"Exception: {str(e)}")
        return False

def test_services_create():
    """Test POST /api/services - create service with auto customer and serviceNumber"""
    try:
        response = requests.post(f"{BASE_URL}/services", headers=headers, json={
            "customerName": "Test Customer",
            "customerPhone": "081234567999",
            "brand": "Samsung",
            "model": "A52",
            "complaint": "Layar pecah",
            "condition": {
                "simCard": "Ada",
                "sdCard": "Tidak Ada"
            },
            "deliveredBy": {
                "type": "owner"
            }
        })
        
        if response.status_code == 200:
            data = response.json()
            service_number = data.get("serviceNumber", "")
            # Check format SRV-YYMMDD-NNN
            if service_number.startswith("SRV-") and len(service_number) == 14:
                print_test("Services: Create with serviceNumber format", True, f"Service: {service_number}, Status: {data.get('status')}")
                return True, data["id"]
            else:
                print_test("Services: Create with serviceNumber format", False, f"Invalid format: {service_number}")
                return False, data.get("id")
        else:
            print_test("Services: Create with serviceNumber format", False, f"Status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_test("Services: Create with serviceNumber format", False, f"Exception: {str(e)}")
        return False, None

def test_services_list():
    """Test GET /api/services with filters"""
    try:
        # Test basic list
        response = requests.get(f"{BASE_URL}/services", headers=headers)
        if response.status_code != 200:
            print_test("Services: GET list", False, f"Status {response.status_code}")
            return False
        
        # Test with search
        response = requests.get(f"{BASE_URL}/services?search=Test", headers=headers)
        if response.status_code != 200:
            print_test("Services: GET list", False, f"Search failed: {response.status_code}")
            return False
        
        # Test with status filter
        response = requests.get(f"{BASE_URL}/services?status=MENUNGGU", headers=headers)
        if response.status_code != 200:
            print_test("Services: GET list", False, f"Status filter failed: {response.status_code}")
            return False
        
        print_test("Services: GET list with filters", True, "All filters working")
        return True
    except Exception as e:
        print_test("Services: GET list with filters", False, f"Exception: {str(e)}")
        return False

def test_services_add_item_with_inventory(service_id, inv_id):
    """Test POST /api/services/:id/items with inventoryId - CRITICAL STOCK TEST"""
    try:
        # Get current inventory stock
        inv_response = requests.get(f"{BASE_URL}/inventory/{inv_id}", headers=headers)
        if inv_response.status_code != 200:
            print_test("Services: Add item with inventory (stock deduction)", False, "Could not fetch inventory")
            return False, None
        
        current_stock = inv_response.json().get("stock", 0)
        
        # Add item to service
        response = requests.post(f"{BASE_URL}/services/{service_id}/items", headers=headers, json={
            "description": "Ganti LCD",
            "inventoryId": inv_id,
            "qty": 1,
            "servicePrice": 150000
        })
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify stock decreased
            inv_response = requests.get(f"{BASE_URL}/inventory/{inv_id}", headers=headers)
            if inv_response.status_code != 200:
                print_test("Services: Add item with inventory (stock deduction)", False, "Could not verify stock")
                return False, None
            
            inv_data = inv_response.json()
            new_stock = inv_data.get("stock", 0)
            movements = inv_data.get("movements", [])
            
            # Check stock decreased
            if new_stock != current_stock - 1:
                print_test("Services: Add item with inventory (stock deduction)", False, f"Stock not decreased: {current_stock} -> {new_stock}")
                return False, None
            
            # Check SERVICE movement exists
            service_movement = any(m.get("type") == "SERVICE" for m in movements)
            if not service_movement:
                print_test("Services: Add item with inventory (stock deduction)", False, "SERVICE movement not found")
                return False, None
            
            # Get item ID
            items = data.get("items", [])
            item_id = items[-1]["id"] if items else None
            
            print_test("Services: Add item with inventory (stock deduction)", True, f"Stock: {current_stock} -> {new_stock}, SERVICE movement created")
            return True, item_id
        else:
            print_test("Services: Add item with inventory (stock deduction)", False, f"Status {response.status_code}: {response.text}")
            return False, None
    except Exception as e:
        print_test("Services: Add item with inventory (stock deduction)", False, f"Exception: {str(e)}")
        return False, None

def test_services_add_item_insufficient_stock(service_id, inv_id):
    """Test that insufficient stock is rejected"""
    try:
        response = requests.post(f"{BASE_URL}/services/{service_id}/items", headers=headers, json={
            "description": "Test insufficient",
            "inventoryId": inv_id,
            "qty": 1000,
            "servicePrice": 100000
        })
        
        if response.status_code == 400:
            print_test("Services: Insufficient stock rejection", True, "400 error returned as expected")
            return True
        else:
            print_test("Services: Insufficient stock rejection", False, f"Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        print_test("Services: Insufficient stock rejection", False, f"Exception: {str(e)}")
        return False

def test_services_add_item_manual(service_id):
    """Test POST /api/services/:id/items without inventoryId (manual item)"""
    try:
        response = requests.post(f"{BASE_URL}/services/{service_id}/items", headers=headers, json={
            "description": "Servis manual",
            "sparepartName": "Manual part",
            "sparepartPrice": 50000,
            "qty": 1,
            "servicePrice": 100000
        })
        
        if response.status_code == 200:
            print_test("Services: Add manual item (no stock change)", True)
            return True
        else:
            print_test("Services: Add manual item (no stock change)", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Services: Add manual item (no stock change)", False, f"Exception: {str(e)}")
        return False

def test_services_remove_item(service_id, item_id, inv_id):
    """Test DELETE /api/services/:id/items/:itemId - CRITICAL STOCK RESTORATION TEST"""
    try:
        # Get current inventory stock
        inv_response = requests.get(f"{BASE_URL}/inventory/{inv_id}", headers=headers)
        if inv_response.status_code != 200:
            print_test("Services: Remove item (stock restoration)", False, "Could not fetch inventory")
            return False
        
        current_stock = inv_response.json().get("stock", 0)
        
        # Remove item
        response = requests.delete(f"{BASE_URL}/services/{service_id}/items/{item_id}", headers=headers)
        
        if response.status_code == 200:
            # Verify stock increased
            inv_response = requests.get(f"{BASE_URL}/inventory/{inv_id}", headers=headers)
            if inv_response.status_code != 200:
                print_test("Services: Remove item (stock restoration)", False, "Could not verify stock")
                return False
            
            new_stock = inv_response.json().get("stock", 0)
            
            if new_stock == current_stock + 1:
                print_test("Services: Remove item (stock restoration)", True, f"Stock restored: {current_stock} -> {new_stock}")
                return True
            else:
                print_test("Services: Remove item (stock restoration)", False, f"Stock not restored: {current_stock} -> {new_stock}")
                return False
        else:
            print_test("Services: Remove item (stock restoration)", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Services: Remove item (stock restoration)", False, f"Exception: {str(e)}")
        return False

def test_services_update_payment(service_id):
    """Test PUT /api/services/:id with payment"""
    try:
        # Get service to check total
        svc_response = requests.get(f"{BASE_URL}/services/{service_id}", headers=headers)
        if svc_response.status_code != 200:
            print_test("Services: Update payment status", False, "Could not fetch service")
            return False
        
        total = svc_response.json().get("payment", {}).get("total", 0)
        
        # Pay full amount
        response = requests.put(f"{BASE_URL}/services/{service_id}", headers=headers, json={
            "payment": {
                "paid": total
            }
        })
        
        if response.status_code == 200:
            data = response.json()
            payment_status = data.get("payment", {}).get("status", "")
            if payment_status == "Lunas":
                print_test("Services: Update payment status", True, f"Status: {payment_status}")
                return True
            else:
                print_test("Services: Update payment status", False, f"Expected 'Lunas', got '{payment_status}'")
                return False
        else:
            print_test("Services: Update payment status", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Services: Update payment status", False, f"Exception: {str(e)}")
        return False

def test_services_update_status_selesai(service_id):
    """Test PUT /api/services/:id with status SELESAI"""
    try:
        response = requests.put(f"{BASE_URL}/services/{service_id}", headers=headers, json={
            "status": "SELESAI"
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "SELESAI" and data.get("completedAt"):
                print_test("Services: Update status to SELESAI", True, f"completedAt: {data.get('completedAt')}")
                return True
            else:
                print_test("Services: Update status to SELESAI", False, "Status or completedAt not set")
                return False
        else:
            print_test("Services: Update status to SELESAI", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Services: Update status to SELESAI", False, f"Exception: {str(e)}")
        return False

def test_services_handover(service_id):
    """Test POST /api/services/:id/handover"""
    try:
        response = requests.post(f"{BASE_URL}/services/{service_id}/handover", headers=headers, json={
            "checklist": {
                "simCard": True,
                "charger": False
            },
            "note": "Test handover"
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "SUDAH_DIAMBIL" and data.get("handover"):
                print_test("Services: Handover (status SUDAH_DIAMBIL)", True)
                return True
            else:
                print_test("Services: Handover (status SUDAH_DIAMBIL)", False, "Status not updated")
                return False
        else:
            print_test("Services: Handover (status SUDAH_DIAMBIL)", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Services: Handover (status SUDAH_DIAMBIL)", False, f"Exception: {str(e)}")
        return False

def test_services_cancel_restore_stock():
    """Test PUT /api/services/:id with status BATAL - CRITICAL STOCK RESTORATION TEST"""
    try:
        # Create new service
        svc_response = requests.post(f"{BASE_URL}/services", headers=headers, json={
            "customerName": "Test Cancel",
            "customerPhone": "081234567888",
            "brand": "Test",
            "model": "Test",
            "complaint": "Test cancel"
        })
        
        if svc_response.status_code != 200:
            print_test("Services: Cancel service (stock restoration)", False, "Could not create service")
            return False
        
        service_id = svc_response.json()["id"]
        
        # Get inventory with stock
        inv_list = requests.get(f"{BASE_URL}/inventory", headers=headers)
        if inv_list.status_code != 200:
            print_test("Services: Cancel service (stock restoration)", False, "Could not fetch inventory")
            return False
        
        inventories = inv_list.json()
        inv_with_stock = next((i for i in inventories if i.get("stock", 0) > 0), None)
        if not inv_with_stock:
            print_test("Services: Cancel service (stock restoration)", False, "No inventory with stock")
            return False
        
        inv_id = inv_with_stock["id"]
        current_stock = inv_with_stock["stock"]
        
        # Add item to service
        add_response = requests.post(f"{BASE_URL}/services/{service_id}/items", headers=headers, json={
            "description": "Test cancel item",
            "inventoryId": inv_id,
            "qty": 1,
            "servicePrice": 100000
        })
        
        if add_response.status_code != 200:
            print_test("Services: Cancel service (stock restoration)", False, "Could not add item")
            return False
        
        # Verify stock decreased
        inv_check = requests.get(f"{BASE_URL}/inventory/{inv_id}", headers=headers)
        stock_after_add = inv_check.json().get("stock", 0)
        if stock_after_add != current_stock - 1:
            print_test("Services: Cancel service (stock restoration)", False, f"Stock not decreased properly")
            return False
        
        # Cancel service
        cancel_response = requests.put(f"{BASE_URL}/services/{service_id}", headers=headers, json={
            "status": "BATAL"
        })
        
        if cancel_response.status_code != 200:
            print_test("Services: Cancel service (stock restoration)", False, f"Cancel failed: {cancel_response.status_code}")
            return False
        
        # Verify stock restored
        inv_final = requests.get(f"{BASE_URL}/inventory/{inv_id}", headers=headers)
        final_stock = inv_final.json().get("stock", 0)
        
        if final_stock == current_stock:
            print_test("Services: Cancel service (stock restoration)", True, f"Stock restored: {stock_after_add} -> {final_stock}")
            return True
        else:
            print_test("Services: Cancel service (stock restoration)", False, f"Stock not restored: expected {current_stock}, got {final_stock}")
            return False
    except Exception as e:
        print_test("Services: Cancel service (stock restoration)", False, f"Exception: {str(e)}")
        return False

def test_sales_create():
    """Test POST /api/sales - CRITICAL STOCK DEDUCTION TEST"""
    try:
        # Get inventory with stock
        inv_list = requests.get(f"{BASE_URL}/inventory", headers=headers)
        if inv_list.status_code != 200:
            print_test("Sales: Create sale (stock deduction)", False, "Could not fetch inventory")
            return False
        
        inventories = inv_list.json()
        inv_with_stock = next((i for i in inventories if i.get("stock", 0) >= 2), None)
        if not inv_with_stock:
            print_test("Sales: Create sale (stock deduction)", False, "No inventory with sufficient stock")
            return False
        
        inv_id = inv_with_stock["id"]
        current_stock = inv_with_stock["stock"]
        
        # Create sale
        response = requests.post(f"{BASE_URL}/sales", headers=headers, json={
            "items": [
                {
                    "inventoryId": inv_id,
                    "name": inv_with_stock["name"],
                    "qty": 2,
                    "price": inv_with_stock.get("sellPrice", 100000)
                }
            ]
        })
        
        if response.status_code == 200:
            data = response.json()
            sale_number = data.get("saleNumber", "")
            
            # Check format SALE-YYMMDD-NNN
            if not sale_number.startswith("SALE-") or len(sale_number) != 15:
                print_test("Sales: Create sale (stock deduction)", False, f"Invalid saleNumber format: {sale_number}")
                return False
            
            # Verify stock decreased
            inv_check = requests.get(f"{BASE_URL}/inventory/{inv_id}", headers=headers)
            if inv_check.status_code != 200:
                print_test("Sales: Create sale (stock deduction)", False, "Could not verify stock")
                return False
            
            inv_data = inv_check.json()
            new_stock = inv_data.get("stock", 0)
            movements = inv_data.get("movements", [])
            
            # Check stock decreased
            if new_stock != current_stock - 2:
                print_test("Sales: Create sale (stock deduction)", False, f"Stock not decreased: {current_stock} -> {new_stock}")
                return False
            
            # Check PENJUALAN movement exists
            sale_movement = any(m.get("type") == "PENJUALAN" for m in movements)
            if not sale_movement:
                print_test("Sales: Create sale (stock deduction)", False, "PENJUALAN movement not found")
                return False
            
            print_test("Sales: Create sale (stock deduction)", True, f"Sale: {sale_number}, Stock: {current_stock} -> {new_stock}, PENJUALAN movement created")
            return True
        else:
            print_test("Sales: Create sale (stock deduction)", False, f"Status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_test("Sales: Create sale (stock deduction)", False, f"Exception: {str(e)}")
        return False

def test_sales_insufficient_stock():
    """Test that insufficient stock is rejected for sales"""
    try:
        # Get any inventory
        inv_list = requests.get(f"{BASE_URL}/inventory", headers=headers)
        if inv_list.status_code != 200:
            print_test("Sales: Insufficient stock rejection", False, "Could not fetch inventory")
            return False
        
        inventories = inv_list.json()
        if not inventories:
            print_test("Sales: Insufficient stock rejection", False, "No inventory items")
            return False
        
        inv = inventories[0]
        
        # Try to sell more than available
        response = requests.post(f"{BASE_URL}/sales", headers=headers, json={
            "items": [
                {
                    "inventoryId": inv["id"],
                    "name": inv["name"],
                    "qty": 10000,
                    "price": 100000
                }
            ]
        })
        
        if response.status_code == 400:
            print_test("Sales: Insufficient stock rejection", True, "400 error returned as expected")
            return True
        else:
            print_test("Sales: Insufficient stock rejection", False, f"Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        print_test("Sales: Insufficient stock rejection", False, f"Exception: {str(e)}")
        return False

def test_sales_list():
    """Test GET /api/sales"""
    try:
        response = requests.get(f"{BASE_URL}/sales", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print_test("Sales: GET list", True, f"Found {len(data)} sales")
                return True
            else:
                print_test("Sales: GET list", False, "Response is not a list")
                return False
        else:
            print_test("Sales: GET list", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Sales: GET list", False, f"Exception: {str(e)}")
        return False

def test_customers_create():
    """Test POST /api/customers with phone deduplication"""
    try:
        phone = "081234567777"
        
        # Create first customer
        response1 = requests.post(f"{BASE_URL}/customers", headers=headers, json={
            "name": "Test Customer 1",
            "phone": phone
        })
        
        if response1.status_code != 200:
            print_test("Customers: Create with phone dedupe", False, f"First create failed: {response1.status_code}")
            return False
        
        customer1_id = response1.json()["id"]
        
        # Try to create duplicate
        response2 = requests.post(f"{BASE_URL}/customers", headers=headers, json={
            "name": "Test Customer 2",
            "phone": phone
        })
        
        if response2.status_code == 200:
            customer2_id = response2.json()["id"]
            if customer1_id == customer2_id:
                print_test("Customers: Create with phone dedupe", True, "Duplicate phone returned existing customer")
                return True
            else:
                print_test("Customers: Create with phone dedupe", False, "Duplicate created instead of returning existing")
                return False
        else:
            print_test("Customers: Create with phone dedupe", False, f"Second create failed: {response2.status_code}")
            return False
    except Exception as e:
        print_test("Customers: Create with phone dedupe", False, f"Exception: {str(e)}")
        return False

def test_customers_list():
    """Test GET /api/customers with search"""
    try:
        # Test basic list
        response = requests.get(f"{BASE_URL}/customers", headers=headers)
        if response.status_code != 200:
            print_test("Customers: GET list with search", False, f"List failed: {response.status_code}")
            return False
        
        # Test with search
        response = requests.get(f"{BASE_URL}/customers?search=Test", headers=headers)
        if response.status_code != 200:
            print_test("Customers: GET list with search", False, f"Search failed: {response.status_code}")
            return False
        
        print_test("Customers: GET list with search", True)
        return True
    except Exception as e:
        print_test("Customers: GET list with search", False, f"Exception: {str(e)}")
        return False

def test_customers_search_by_phone():
    """Test GET /api/customers/search?phone="""
    try:
        response = requests.get(f"{BASE_URL}/customers/search?phone=081234567777", headers=headers)
        
        if response.status_code == 200:
            print_test("Customers: Search by phone", True)
            return True
        else:
            print_test("Customers: Search by phone", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Customers: Search by phone", False, f"Exception: {str(e)}")
        return False

def test_customers_detail_with_services():
    """Test GET /api/customers/:id returns services history"""
    try:
        # Get a customer
        list_response = requests.get(f"{BASE_URL}/customers", headers=headers)
        if list_response.status_code != 200:
            print_test("Customers: Detail with services history", False, "Could not fetch customers")
            return False
        
        customers = list_response.json()
        if not customers:
            print_test("Customers: Detail with services history", False, "No customers found")
            return False
        
        customer_id = customers[0]["id"]
        
        # Get customer detail
        response = requests.get(f"{BASE_URL}/customers/{customer_id}", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if "services" in data and isinstance(data["services"], list):
                print_test("Customers: Detail with services history", True, f"Found {len(data['services'])} services")
                return True
            else:
                print_test("Customers: Detail with services history", False, "Services array not found")
                return False
        else:
            print_test("Customers: Detail with services history", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Customers: Detail with services history", False, f"Exception: {str(e)}")
        return False

def test_dashboard():
    """Test GET /api/dashboard"""
    try:
        response = requests.get(f"{BASE_URL}/dashboard", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            required_keys = ["service", "inventory", "sales", "recent"]
            if all(key in data for key in required_keys):
                print_test("Dashboard: GET stats and recent", True, f"Service active: {data['service'].get('active')}, Inventory total: {data['inventory'].get('total')}")
                return True
            else:
                print_test("Dashboard: GET stats and recent", False, "Missing required keys")
                return False
        else:
            print_test("Dashboard: GET stats and recent", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Dashboard: GET stats and recent", False, f"Exception: {str(e)}")
        return False

def test_reports_services():
    """Test GET /api/reports/services"""
    try:
        response = requests.get(f"{BASE_URL}/reports/services?period=month", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            required_keys = ["total", "done", "notDone", "revenue", "collected", "services"]
            if all(key in data for key in required_keys):
                print_test("Reports: Services report", True, f"Total: {data['total']}, Revenue: {data['revenue']}")
                return True
            else:
                print_test("Reports: Services report", False, "Missing required keys")
                return False
        else:
            print_test("Reports: Services report", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Reports: Services report", False, f"Exception: {str(e)}")
        return False

def test_reports_sales():
    """Test GET /api/reports/sales"""
    try:
        response = requests.get(f"{BASE_URL}/reports/sales?period=month", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            required_keys = ["count", "total", "sales"]
            if all(key in data for key in required_keys):
                print_test("Reports: Sales report", True, f"Count: {data['count']}, Total: {data['total']}")
                return True
            else:
                print_test("Reports: Sales report", False, "Missing required keys")
                return False
        else:
            print_test("Reports: Sales report", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Reports: Sales report", False, f"Exception: {str(e)}")
        return False

def test_reports_inventory():
    """Test GET /api/reports/inventory"""
    try:
        response = requests.get(f"{BASE_URL}/reports/inventory", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            required_keys = ["low", "out", "movements"]
            if all(key in data for key in required_keys):
                print_test("Reports: Inventory report", True, f"Low stock: {len(data['low'])}, Out of stock: {len(data['out'])}")
                return True
            else:
                print_test("Reports: Inventory report", False, "Missing required keys")
                return False
        else:
            print_test("Reports: Inventory report", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Reports: Inventory report", False, f"Exception: {str(e)}")
        return False

def test_settings():
    """Test GET and PUT /api/settings"""
    try:
        # GET settings
        get_response = requests.get(f"{BASE_URL}/settings", headers=headers)
        if get_response.status_code != 200:
            print_test("Settings: GET and PUT", False, f"GET failed: {get_response.status_code}")
            return False
        
        # PUT settings
        put_response = requests.put(f"{BASE_URL}/settings", headers=headers, json={
            "shopName": "Test Konter HP"
        })
        
        if put_response.status_code == 200:
            data = put_response.json()
            if data.get("shopName") == "Test Konter HP":
                print_test("Settings: GET and PUT", True, f"Shop name updated")
                return True
            else:
                print_test("Settings: GET and PUT", False, "Shop name not updated")
                return False
        else:
            print_test("Settings: GET and PUT", False, f"PUT failed: {put_response.status_code}")
            return False
    except Exception as e:
        print_test("Settings: GET and PUT", False, f"Exception: {str(e)}")
        return False

def test_seed_create():
    """Test POST /api/seed"""
    try:
        response = requests.post(f"{BASE_URL}/seed", headers=headers)
        
        if response.status_code == 200:
            print_test("Seed: POST create sample data", True)
            return True
        else:
            print_test("Seed: POST create sample data", False, f"Status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_test("Seed: POST create sample data", False, f"Exception: {str(e)}")
        return False

def test_seed_delete():
    """Test DELETE /api/seed"""
    try:
        response = requests.delete(f"{BASE_URL}/seed", headers=headers)
        
        if response.status_code == 200:
            print_test("Seed: DELETE remove sample data", True)
            return True
        else:
            print_test("Seed: DELETE remove sample data", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_test("Seed: DELETE remove sample data", False, f"Exception: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("=" * 80)
    print("KONTER HP BACKEND API TEST")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Login: {LOGIN_EMAIL}")
    print("=" * 80)
    print()
    
    # Track results
    results = {
        "passed": 0,
        "failed": 0,
        "total": 0
    }
    
    def run_test(test_func, *args):
        results["total"] += 1
        try:
            result = test_func(*args)
            if isinstance(result, tuple):
                if result[0]:
                    results["passed"] += 1
                else:
                    results["failed"] += 1
                return result
            else:
                if result:
                    results["passed"] += 1
                else:
                    results["failed"] += 1
                return result
        except Exception as e:
            results["failed"] += 1
            print_test(test_func.__name__, False, f"Unexpected error: {str(e)}")
            return False
    
    # AUTH TESTS
    print("\n" + "=" * 80)
    print("AUTH TESTS")
    print("=" * 80)
    run_test(test_auth_login_success)
    run_test(test_auth_login_wrong_password)
    run_test(test_auth_me_with_token)
    run_test(test_auth_me_without_token)
    
    # INVENTORY TESTS
    print("\n" + "=" * 80)
    print("INVENTORY TESTS (STOCK INTEGRITY)")
    print("=" * 80)
    success, inv_id = run_test(test_inventory_create)
    if success and inv_id:
        run_test(test_inventory_list)
        run_test(test_inventory_adjust_masuk, inv_id)
        run_test(test_inventory_adjust_keluar, inv_id)
        run_test(test_inventory_adjust_penyesuaian, inv_id)
        run_test(test_inventory_negative_stock_rejection, inv_id)
    
    # SERVICES TESTS
    print("\n" + "=" * 80)
    print("SERVICES TESTS (STOCK INTEGRITY)")
    print("=" * 80)
    success, service_id = run_test(test_services_create)
    if success and service_id:
        run_test(test_services_list)
        if inv_id:
            success, item_id = run_test(test_services_add_item_with_inventory, service_id, inv_id)
            run_test(test_services_add_item_insufficient_stock, service_id, inv_id)
            run_test(test_services_add_item_manual, service_id)
            if success and item_id:
                run_test(test_services_remove_item, service_id, item_id, inv_id)
            run_test(test_services_update_payment, service_id)
            run_test(test_services_update_status_selesai, service_id)
            run_test(test_services_handover, service_id)
    
    run_test(test_services_cancel_restore_stock)
    
    # SALES TESTS
    print("\n" + "=" * 80)
    print("SALES TESTS (STOCK INTEGRITY)")
    print("=" * 80)
    run_test(test_sales_create)
    run_test(test_sales_insufficient_stock)
    run_test(test_sales_list)
    
    # CUSTOMERS TESTS
    print("\n" + "=" * 80)
    print("CUSTOMERS TESTS")
    print("=" * 80)
    run_test(test_customers_create)
    run_test(test_customers_list)
    run_test(test_customers_search_by_phone)
    run_test(test_customers_detail_with_services)
    
    # DASHBOARD & REPORTS TESTS
    print("\n" + "=" * 80)
    print("DASHBOARD & REPORTS TESTS")
    print("=" * 80)
    run_test(test_dashboard)
    run_test(test_reports_services)
    run_test(test_reports_sales)
    run_test(test_reports_inventory)
    
    # SETTINGS TESTS
    print("\n" + "=" * 80)
    print("SETTINGS TESTS")
    print("=" * 80)
    run_test(test_settings)
    
    # SEED TESTS
    print("\n" + "=" * 80)
    print("SEED TESTS")
    print("=" * 80)
    run_test(test_seed_create)
    run_test(test_seed_delete)
    
    # SUMMARY
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total Tests: {results['total']}")
    print(f"Passed: {results['passed']} ✅")
    print(f"Failed: {results['failed']} ❌")
    print(f"Success Rate: {(results['passed'] / results['total'] * 100):.1f}%")
    print("=" * 80)
    
    return results["failed"] == 0

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
