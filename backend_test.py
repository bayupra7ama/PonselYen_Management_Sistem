#!/usr/bin/env python3
"""
Backend test for Konter HP revenue flow
Tests handover auto-lunas, dashboard revenue, and reports collected
"""
import requests
import json
from datetime import datetime

BASE_URL = "https://phone-counter-1.preview.emergentagent.com/api"

def test_revenue_flow():
    """Test the complete revenue flow from service creation to handover and reporting"""
    
    print("\n" + "="*80)
    print("TESTING REVENUE FLOW - Handover Auto-Lunas & Dashboard Revenue")
    print("="*80)
    
    # Step 1: Login
    print("\n[1] Authenticating...")
    try:
        login_response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": "ponselyen@gmail.com", "password": "Meranti123"},
            timeout=10
        )
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
            return False
        
        token = login_response.json().get("token")
        if not token:
            print(f"❌ No token in response: {login_response.json()}")
            return False
        
        print(f"✅ Login successful, token obtained")
        headers = {"Authorization": f"Bearer {token}"}
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False
    
    # Step 2: Create a service with work item
    print("\n[2] Creating service with work item (servicePrice: 150000)...")
    try:
        service_data = {
            "customerName": "Test Revenue Customer",
            "customerPhone": "0811222333",
            "brand": "Samsung",
            "model": "A52",
            "complaint": "LCD pecah",
            "condition": {},
            "deliveredBy": {"type": "owner", "name": ""}
        }
        service_response = requests.post(
            f"{BASE_URL}/services",
            json=service_data,
            headers=headers,
            timeout=10
        )
        if service_response.status_code not in [200, 201]:
            print(f"❌ Service creation failed: {service_response.status_code} - {service_response.text}")
            return False
        
        service = service_response.json()
        service_id = service.get("id")
        print(f"✅ Service created: {service_id}")
        
        # Add work item
        item_data = {
            "description": "Ganti LCD",
            "qty": 1,
            "servicePrice": 150000,
            "sparepartPrice": 0,
            "sparepartName": "",
            "inventoryId": None
        }
        item_response = requests.post(
            f"{BASE_URL}/services/{service_id}/items",
            json=item_data,
            headers=headers,
            timeout=10
        )
        if item_response.status_code != 200:
            print(f"❌ Item addition failed: {item_response.status_code} - {item_response.text}")
            return False
        
        service_with_item = item_response.json()
        payment = service_with_item.get("payment", {})
        print(f"✅ Work item added")
        print(f"   Payment total: {payment.get('total')}, paid: {payment.get('paid')}")
        
        if payment.get("total") != 150000:
            print(f"❌ Expected payment.total=150000, got {payment.get('total')}")
            return False
        if payment.get("paid") != 0:
            print(f"❌ Expected payment.paid=0, got {payment.get('paid')}")
            return False
        
        print(f"✅ Payment verification passed: total=150000, paid=0")
        
    except Exception as e:
        print(f"❌ Service creation error: {e}")
        return False
    
    # Step 3: Snapshot dashboard and reports BEFORE handover
    print("\n[3] Taking snapshot of dashboard and reports BEFORE handover...")
    try:
        dashboard_before = requests.get(f"{BASE_URL}/dashboard", headers=headers, timeout=10)
        if dashboard_before.status_code != 200:
            print(f"❌ Dashboard request failed: {dashboard_before.status_code}")
            return False
        
        dash_before = dashboard_before.json()
        revenue_before = dash_before.get("revenue", {})
        before_service = revenue_before.get("todayService", 0)
        before_service_count = revenue_before.get("todayServiceCount", 0)
        before_sales = revenue_before.get("todaySales", 0)
        before_total = revenue_before.get("todayTotal", 0)
        
        print(f"✅ Dashboard BEFORE:")
        print(f"   todayService: {before_service}")
        print(f"   todayServiceCount: {before_service_count}")
        print(f"   todaySales: {before_sales}")
        print(f"   todayTotal: {before_total}")
        
        reports_before = requests.get(f"{BASE_URL}/reports/services?period=today", headers=headers, timeout=10)
        if reports_before.status_code != 200:
            print(f"❌ Reports request failed: {reports_before.status_code}")
            return False
        
        rep_before = reports_before.json()
        
        # Check that 'revenue' field is NOT present
        if "revenue" in rep_before:
            print(f"❌ CRITICAL: 'revenue' field found in reports response (should be removed)")
            print(f"   Response keys: {list(rep_before.keys())}")
            return False
        
        collected_before = rep_before.get("collected", 0)
        collected_count_before = rep_before.get("collectedCount", 0)
        
        print(f"✅ Reports BEFORE:")
        print(f"   collected: {collected_before}")
        print(f"   collectedCount: {collected_count_before}")
        print(f"✅ Verified: 'revenue' field NOT present in reports response")
        
    except Exception as e:
        print(f"❌ Snapshot error: {e}")
        return False
    
    # Step 4: Handover with default markPaid (should auto-lunas)
    print("\n[4] Performing handover (default markPaid=true)...")
    try:
        handover_data = {
            "checklist": {"sim": True},
            "note": "ok"
        }
        handover_response = requests.post(
            f"{BASE_URL}/services/{service_id}/handover",
            json=handover_data,
            headers=headers,
            timeout=10
        )
        if handover_response.status_code != 200:
            print(f"❌ Handover failed: {handover_response.status_code} - {handover_response.text}")
            return False
        
        handover_service = handover_response.json()
        print(f"✅ Handover successful")
        
        # Verify response
        status = handover_service.get("status")
        payment = handover_service.get("payment", {})
        handover_obj = handover_service.get("handover", {})
        
        print(f"   Status: {status}")
        print(f"   Payment paid: {payment.get('paid')}, status: {payment.get('status')}")
        print(f"   Payment paidAt: {payment.get('paidAt')}")
        print(f"   Handover pickedUpAt: {handover_obj.get('pickedUpAt')}")
        
        if status != "SUDAH_DIAMBIL":
            print(f"❌ Expected status=SUDAH_DIAMBIL, got {status}")
            return False
        if payment.get("paid") != 150000:
            print(f"❌ Expected payment.paid=150000, got {payment.get('paid')}")
            return False
        if payment.get("status") != "Lunas":
            print(f"❌ Expected payment.status=Lunas, got {payment.get('status')}")
            return False
        if not payment.get("paidAt"):
            print(f"❌ Expected payment.paidAt to be present")
            return False
        if not handover_obj.get("pickedUpAt"):
            print(f"❌ Expected handover.pickedUpAt to be present")
            return False
        
        print(f"✅ Handover verification passed: status=SUDAH_DIAMBIL, paid=150000, status=Lunas")
        
    except Exception as e:
        print(f"❌ Handover error: {e}")
        return False
    
    # Step 5: Verify dashboard AFTER handover
    print("\n[5] Verifying dashboard AFTER handover...")
    try:
        dashboard_after = requests.get(f"{BASE_URL}/dashboard", headers=headers, timeout=10)
        if dashboard_after.status_code != 200:
            print(f"❌ Dashboard request failed: {dashboard_after.status_code}")
            return False
        
        dash_after = dashboard_after.json()
        revenue_after = dash_after.get("revenue", {})
        after_service = revenue_after.get("todayService", 0)
        after_service_count = revenue_after.get("todayServiceCount", 0)
        after_sales = revenue_after.get("todaySales", 0)
        after_total = revenue_after.get("todayTotal", 0)
        
        print(f"✅ Dashboard AFTER:")
        print(f"   todayService: {after_service} (was {before_service})")
        print(f"   todayServiceCount: {after_service_count} (was {before_service_count})")
        print(f"   todaySales: {after_sales} (was {before_sales})")
        print(f"   todayTotal: {after_total} (was {before_total})")
        
        # Verify increases
        service_increase = after_service - before_service
        count_increase = after_service_count - before_service_count
        
        if service_increase != 150000:
            print(f"❌ Expected todayService to increase by 150000, increased by {service_increase}")
            return False
        if count_increase != 1:
            print(f"❌ Expected todayServiceCount to increase by 1, increased by {count_increase}")
            return False
        if after_total != after_service + after_sales:
            print(f"❌ Expected todayTotal={after_service + after_sales}, got {after_total}")
            return False
        
        print(f"✅ Dashboard verification passed: todayService increased by exactly 150000, count +1")
        
    except Exception as e:
        print(f"❌ Dashboard verification error: {e}")
        return False
    
    # Step 6: Verify reports AFTER handover
    print("\n[6] Verifying reports AFTER handover...")
    try:
        reports_after = requests.get(f"{BASE_URL}/reports/services?period=today", headers=headers, timeout=10)
        if reports_after.status_code != 200:
            print(f"❌ Reports request failed: {reports_after.status_code}")
            return False
        
        rep_after = reports_after.json()
        
        # Check that 'revenue' field is NOT present
        if "revenue" in rep_after:
            print(f"❌ CRITICAL: 'revenue' field found in reports response (should be removed)")
            return False
        
        collected_after = rep_after.get("collected", 0)
        collected_count_after = rep_after.get("collectedCount", 0)
        collected_services = rep_after.get("collectedServices", [])
        
        print(f"✅ Reports AFTER:")
        print(f"   collected: {collected_after} (was {collected_before})")
        print(f"   collectedCount: {collected_count_after} (was {collected_count_before})")
        print(f"   collectedServices count: {len(collected_services)}")
        
        # Verify increases
        collected_increase = collected_after - collected_before
        count_increase = collected_count_after - collected_count_before
        
        if collected_increase != 150000:
            print(f"❌ Expected collected to increase by 150000, increased by {collected_increase}")
            return False
        if count_increase != 1:
            print(f"❌ Expected collectedCount to increase by 1, increased by {count_increase}")
            return False
        
        # Verify service is in collectedServices
        service_ids = [s.get("id") for s in collected_services]
        if service_id not in service_ids:
            print(f"❌ Service {service_id} not found in collectedServices")
            return False
        
        # Find our service and verify payment
        our_service = next((s for s in collected_services if s.get("id") == service_id), None)
        if not our_service:
            print(f"❌ Could not find our service in collectedServices")
            return False
        
        service_paid = our_service.get("payment", {}).get("paid", 0)
        if service_paid != 150000:
            print(f"❌ Expected service payment.paid=150000 in collectedServices, got {service_paid}")
            return False
        
        print(f"✅ Reports verification passed: collected increased by 150000, count +1, service present with paid=150000")
        print(f"✅ Verified: 'revenue' field NOT present in reports response")
        
    except Exception as e:
        print(f"❌ Reports verification error: {e}")
        return False
    
    # Step 7: Negative case - handover with markPaid=false
    print("\n[7] Testing negative case: handover with markPaid=false...")
    try:
        # Create another service
        service_data2 = {
            "customerName": "Test No Payment",
            "customerPhone": "0822333444",
            "brand": "Xiaomi",
            "model": "Redmi Note 10",
            "complaint": "Baterai bocor",
            "condition": {},
            "deliveredBy": {"type": "owner", "name": ""}
        }
        service_response2 = requests.post(
            f"{BASE_URL}/services",
            json=service_data2,
            headers=headers,
            timeout=10
        )
        if service_response2.status_code not in [200, 201]:
            print(f"❌ Service 2 creation failed: {service_response2.status_code}")
            return False
        
        service2 = service_response2.json()
        service_id2 = service2.get("id")
        print(f"✅ Service 2 created: {service_id2}")
        
        # Add work item with servicePrice 50000
        item_data2 = {
            "description": "Ganti baterai",
            "qty": 1,
            "servicePrice": 50000,
            "sparepartPrice": 0,
            "sparepartName": "",
            "inventoryId": None
        }
        item_response2 = requests.post(
            f"{BASE_URL}/services/{service_id2}/items",
            json=item_data2,
            headers=headers,
            timeout=10
        )
        if item_response2.status_code != 200:
            print(f"❌ Item 2 addition failed: {item_response2.status_code}")
            return False
        
        print(f"✅ Work item added to service 2 (servicePrice: 50000)")
        
        # Snapshot before second handover
        dashboard_before2 = requests.get(f"{BASE_URL}/dashboard", headers=headers, timeout=10).json()
        reports_before2 = requests.get(f"{BASE_URL}/reports/services?period=today", headers=headers, timeout=10).json()
        
        before_service2 = dashboard_before2.get("revenue", {}).get("todayService", 0)
        collected_before2 = reports_before2.get("collected", 0)
        collected_count_before2 = reports_before2.get("collectedCount", 0)
        
        print(f"   Dashboard before: todayService={before_service2}")
        print(f"   Reports before: collected={collected_before2}, collectedCount={collected_count_before2}")
        
        # Handover with markPaid=false
        handover_data2 = {
            "checklist": {},
            "note": "",
            "markPaid": False
        }
        handover_response2 = requests.post(
            f"{BASE_URL}/services/{service_id2}/handover",
            json=handover_data2,
            headers=headers,
            timeout=10
        )
        if handover_response2.status_code != 200:
            print(f"❌ Handover 2 failed: {handover_response2.status_code}")
            return False
        
        handover_service2 = handover_response2.json()
        status2 = handover_service2.get("status")
        payment2 = handover_service2.get("payment", {})
        
        print(f"✅ Handover 2 successful")
        print(f"   Status: {status2}")
        print(f"   Payment paid: {payment2.get('paid')}, status: {payment2.get('status')}")
        
        if status2 != "SUDAH_DIAMBIL":
            print(f"❌ Expected status=SUDAH_DIAMBIL, got {status2}")
            return False
        if payment2.get("paid") != 0:
            print(f"❌ Expected payment.paid=0 (markPaid=false), got {payment2.get('paid')}")
            return False
        if payment2.get("status") == "Lunas":
            print(f"❌ Expected payment.status NOT to be Lunas (markPaid=false), got {payment2.get('status')}")
            return False
        
        print(f"✅ Handover 2 verification passed: status=SUDAH_DIAMBIL, paid=0, status={payment2.get('status')}")
        
        # Verify dashboard and reports did NOT increase revenue
        dashboard_after2 = requests.get(f"{BASE_URL}/dashboard", headers=headers, timeout=10).json()
        reports_after2 = requests.get(f"{BASE_URL}/reports/services?period=today", headers=headers, timeout=10).json()
        
        after_service2 = dashboard_after2.get("revenue", {}).get("todayService", 0)
        collected_after2 = reports_after2.get("collected", 0)
        collected_count_after2 = reports_after2.get("collectedCount", 0)
        
        print(f"   Dashboard after: todayService={after_service2} (was {before_service2})")
        print(f"   Reports after: collected={collected_after2} (was {collected_before2}), collectedCount={collected_count_after2} (was {collected_count_before2})")
        
        service_increase2 = after_service2 - before_service2
        collected_increase2 = collected_after2 - collected_before2
        count_increase2 = collected_count_after2 - collected_count_before2
        
        if service_increase2 != 0:
            print(f"❌ Expected todayService NOT to increase (markPaid=false), increased by {service_increase2}")
            return False
        if collected_increase2 != 0:
            print(f"❌ Expected collected NOT to increase (markPaid=false), increased by {collected_increase2}")
            return False
        
        # Note: collectedCount might increase by 1 because the service is picked up (status=SUDAH_DIAMBIL)
        # but collected amount should not increase because paid=0
        print(f"✅ Negative case verification passed: todayService did NOT increase, collected did NOT increase")
        print(f"   Note: collectedCount increased by {count_increase2} (acceptable - service is picked up but not paid)")
        
    except Exception as e:
        print(f"❌ Negative case error: {e}")
        return False
    
    # Step 8: Verify monthly report works
    print("\n[8] Verifying monthly report...")
    try:
        reports_month = requests.get(f"{BASE_URL}/reports/services?period=month", headers=headers, timeout=10)
        if reports_month.status_code != 200:
            print(f"❌ Monthly report request failed: {reports_month.status_code}")
            return False
        
        rep_month = reports_month.json()
        
        if "revenue" in rep_month:
            print(f"❌ CRITICAL: 'revenue' field found in monthly report (should be removed)")
            return False
        
        if "collected" not in rep_month or "collectedCount" not in rep_month or "collectedServices" not in rep_month:
            print(f"❌ Missing required fields in monthly report")
            print(f"   Keys: {list(rep_month.keys())}")
            return False
        
        print(f"✅ Monthly report working:")
        print(f"   collected: {rep_month.get('collected')}")
        print(f"   collectedCount: {rep_month.get('collectedCount')}")
        print(f"   collectedServices count: {len(rep_month.get('collectedServices', []))}")
        print(f"✅ Verified: 'revenue' field NOT present in monthly report")
        
    except Exception as e:
        print(f"❌ Monthly report error: {e}")
        return False
    
    print("\n" + "="*80)
    print("✅ ALL REVENUE FLOW TESTS PASSED")
    print("="*80)
    return True


if __name__ == "__main__":
    success = test_revenue_flow()
    exit(0 if success else 1)
