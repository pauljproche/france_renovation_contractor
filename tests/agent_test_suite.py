#!/usr/bin/env python3
"""
Agent Test Suite for France Renovation Contractor

This test suite validates the agent's functionality across three main categories:
1. TODO tests - What needs to be done today as different roles
2. VALIDATION tests - What needs to be validated by different roles
3. EDITING MATERIALS TABLE tests - Specific pipeline for editing materials (strict, exact steps)

The editing tests are designed to modify only the "beegcat" item in the cuisine section
and restore it to its original state after testing.
"""

import json
import os
import sys
import shutil
import re
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple, Set
import requests
from dataclasses import dataclass, field

# Add parent directory to path to import backend functions
sys.path.insert(0, str(Path(__file__).parent.parent))

# Configuration
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
MATERIALS_FILE = DATA_DIR / "materials.json"
BACKUP_DIR = BASE_DIR / "tests" / "backups"
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

# Ensure backup directory exists
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class TestResult:
    """Result of a single test case"""
    name: str
    passed: bool
    message: str
    duration: float = 0.0
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TestSuite:
    """Container for test results"""
    name: str
    results: List[TestResult] = field(default_factory=list)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    def add_result(self, result: TestResult):
        self.results.append(result)

    def get_summary(self) -> Dict[str, Any]:
        passed = sum(1 for r in self.results if r.passed)
        total = len(self.results)
        duration = (self.end_time - self.start_time).total_seconds() if self.end_time and self.start_time else 0
        return {
            "name": self.name,
            "passed": passed,
            "total": total,
            "failed": total - passed,
            "duration": duration,
            "success_rate": (passed / total * 100) if total > 0 else 0
        }


class MaterialsDataManager:
    """Manages materials data backup and restoration"""

    def __init__(self, materials_file: Path):
        self.materials_file = materials_file
        self.backup_dir = BACKUP_DIR

    def backup(self, label: str = "test") -> Path:
        """Create a backup of materials.json"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = self.backup_dir / f"materials_{label}_{timestamp}.json"
        shutil.copy2(self.materials_file, backup_file)
        return backup_file

    def restore(self, backup_file: Path) -> bool:
        """Restore materials.json from backup"""
        try:
            shutil.copy2(backup_file, self.materials_file)
            return True
        except Exception as e:
            print(f"Error restoring backup: {e}")
            return False

    def load(self) -> Dict[str, Any]:
        """Load materials data"""
        with open(self.materials_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def save(self, data: Dict[str, Any]) -> bool:
        """Save materials data"""
        try:
            with open(self.materials_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving materials: {e}")
            return False

    def get_beegcat_item(self) -> Optional[Tuple[str, int, Dict[str, Any]]]:
        """Find the beegcat item and return (section_id, item_index, item_data)"""
        data = self.load()
        for section in data.get('sections', []):
            section_id = section.get('id', '')
            section_label = section.get('label', '').lower()
            # Check if this is the cuisine section
            if 'cuisine' in section_label or section_id.lower() == 'kitchen':
                for idx, item in enumerate(section.get('items', [])):
                    if item.get('product', '').lower() == 'beegcat':
                        return (section_id, idx, item.copy())
        return None

    def get_beegcat_original_state(self) -> Optional[Dict[str, Any]]:
        """Get the original state of beegcat item"""
        result = self.get_beegcat_item()
        if result:
            _, _, item = result
            return item
        return None


class AgentTester:
    """Tests the agent via API"""

    def __init__(self, api_base_url: str = API_BASE_URL):
        self.api_base_url = api_base_url
        self.data_manager = MaterialsDataManager(MATERIALS_FILE)

    def query_agent(self, prompt: str, materials: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Query the agent via API"""
        if materials is None:
            materials = self.data_manager.load()

        response = requests.post(
            f"{self.api_base_url}/api/assistant/query",
            json={
                "prompt": prompt,
                "materials": materials,
                "customTables": None
            },
            timeout=30
        )
        response.raise_for_status()
        return response.json()

    def update_materials(self, materials: Dict[str, Any]) -> bool:
        """Update materials via API"""
        response = requests.put(
            f"{self.api_base_url}/api/materials",
            json={"materials": materials},
            timeout=10
        )
        return response.status_code == 200

    def count_todo_items(self, role: str) -> Tuple[int, List[Dict[str, Any]]]:
        """
        Count items that need action for a specific role (TODO items).
        Based on system prompt, TODO items include:
        1. Items requiring validation by that role (status: rejected, change_order, or pending/null)
        2. Items that need to be ordered (order.ordered: false)
        3. Items with pending deliveries (order.delivery.status or order.delivery.date)
        
        Returns (count, list of items needing action).
        """
        materials = self.data_manager.load()
        todo_items = []
        
        # Map role names to approval field
        role_map = {
            "client": "client",
            "contractor": "cray",
            "cray": "cray",
            "architect": "cray"
        }
        
        approval_role = role_map.get(role.lower(), role.lower())
        
        for section in materials.get('sections', []):
            section_label = section.get('label', '')
            section_id = section.get('id', '')
            
            for idx, item in enumerate(section.get('items', [])):
                product = item.get('product', '')
                needs_action = False
                action_reasons = []
                
                # 1. Check validation requirements
                approvals = item.get('approvals', {})
                role_approval = approvals.get(approval_role, {})
                status = role_approval.get('status')
                if status != "approved":
                    needs_action = True
                    action_reasons.append(f"validation ({status or 'pending'})")
                
                # 2. Check ordering status
                order = item.get('order', {})
                if order.get('ordered') is False:
                    needs_action = True
                    action_reasons.append("needs ordering")
                
                # 3. Check delivery tracking
                delivery = order.get('delivery', {})
                if delivery.get('date') or delivery.get('status'):
                    needs_action = True
                    action_reasons.append("delivery tracking")
                
                if needs_action:
                    todo_items.append({
                        "section": section_label,
                        "section_id": section_id,
                        "product": product,
                        "action_reasons": action_reasons,
                        "item_index": idx
                    })
        
        return len(todo_items), todo_items

    def test_todo_query(self, role: str, variant: str = "") -> TestResult:
        """Test TODO query for a specific role"""
        test_name = f"TODO - {role.upper()}{' - ' + variant if variant else ''}"
        start_time = datetime.now()

        try:
            # Variants of TODO queries
            prompts = {
                "default": f"What needs to be done today as {role}?",
                "what_do_i_need": f"What do I need to do today as {role}?",
                "what_are_my_tasks": f"What are my tasks as {role}?",
                "what_should_i_do": f"What should I do as {role}?",
                "action_items": f"What are the action items for {role}?",
            }

            prompt = prompts.get(variant, prompts["default"])

            # Get expected count and items from actual data
            expected_count, expected_items = self.count_todo_items(role)
            expected_product_names = [item["product"] for item in expected_items]

            response = self.query_agent(prompt)
            answer = response.get("answer", "")

            # Basic validation - answer should not be empty
            passed = bool(answer and len(answer.strip()) > 0)

            # Check if answer mentions the role
            answer_lower = answer.lower()
            role_mentioned = role.lower() in answer_lower

            # Check if answer has some structure (lists, bullets, etc.)
            has_structure = any(marker in answer for marker in ["•", "-", "*", ":", "\n"])

            # Check for task-related keywords
            has_task_keywords = any(kw in answer_lower for kw in [
                "task", "action", "need", "do", "order", "validate", "delivery", "pending"
            ])

            # Extract count from response
            response_count = self.extract_count_from_response(answer)
            count_matches = response_count == expected_count if response_count is not None else False
            count_close = False
            if response_count is not None and expected_count > 0:
                # Allow some tolerance (within 10% or 2 items)
                count_close = abs(response_count - expected_count) <= max(2, expected_count * 0.1)

            # Extract items from response
            response_items = self.extract_items_from_response(answer)
            
            # Check if response contains at least some of the expected items
            items_found = 0
            if response_items and expected_product_names:
                answer_lower_full = answer_lower
                for expected_product in expected_product_names:
                    if expected_product.lower() in answer_lower_full:
                        items_found += 1
                
                # We want at least 50% of items to be found, or at least 1 if there are few items
                min_items_required = max(1, int(len(expected_product_names) * 0.5))
                items_match = items_found >= min_items_required
            else:
                items_match = True  # If no items expected, any response is fine

            duration = (datetime.now() - start_time).total_seconds()

            # Determine if test passed
            test_passed = (
                passed and 
                role_mentioned and 
                has_structure and
                has_task_keywords and
                (count_matches or count_close or expected_count == 0) and  # Allow if no items expected
                (items_match or expected_count == 0)  # Allow if no items expected
            )

            message = "PASSED" if test_passed else "FAILED"
            issues = []
            if not passed:
                issues.append("empty response")
            if not role_mentioned:
                issues.append("role not mentioned")
            if not has_structure:
                issues.append("response lacks structure")
            if not has_task_keywords:
                issues.append("task keywords missing")
            if expected_count > 0:
                if not count_matches and not count_close:
                    if response_count is not None:
                        issues.append(f"count mismatch: expected {expected_count}, got {response_count}")
                    else:
                        issues.append(f"count not found (expected {expected_count})")
                if not items_match:
                    issues.append(f"items mismatch: found {items_found}/{len(expected_product_names)} expected items")
            
            if issues:
                message += " - " + ", ".join(issues)

            return TestResult(
                name=test_name,
                passed=test_passed,
                message=message,
                duration=duration,
                details={
                    "prompt": prompt,
                    "answer_length": len(answer),
                    "expected_count": expected_count,
                    "response_count": response_count,
                    "count_matches": count_matches or count_close,
                    "expected_items_count": len(expected_product_names),
                    "response_items_count": len(response_items),
                    "items_found": items_found,
                    "items_match": items_match,
                    "role_mentioned": role_mentioned,
                    "has_structure": has_structure,
                    "has_task_keywords": has_task_keywords,
                    "expected_items": expected_product_names[:10],  # First 10 for preview
                    "response_items": response_items[:10],  # First 10 for preview
                    "answer_preview": answer[:500] + "..." if len(answer) > 500 else answer
                }
            )

        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            return TestResult(
                name=test_name,
                passed=False,
                message=f"FAILED - Exception: {str(e)}",
                duration=duration,
                details={"error": str(e)}
            )

    def count_items_needing_validation(self, role: str) -> Tuple[int, List[Dict[str, Any]]]:
        """
        Count items that need validation for a specific role.
        Returns (count, list of items needing validation).
        Items need validation if status is: rejected, change_order, null, or any non-approved status.
        """
        materials = self.data_manager.load()
        items_needing_validation = []
        
        # Map role names to approval field
        role_map = {
            "client": "client",
            "contractor": "cray",
            "cray": "cray",
            "architect": "cray"  # Architect typically uses cray validation
        }
        
        approval_role = role_map.get(role.lower(), role.lower())
        
        for section in materials.get('sections', []):
            section_label = section.get('label', '')
            section_id = section.get('id', '')
            
            for idx, item in enumerate(section.get('items', [])):
                product = item.get('product', '')
                approvals = item.get('approvals', {})
                role_approval = approvals.get(approval_role, {})
                status = role_approval.get('status')
                
                # Item needs validation if status is not "approved"
                if status != "approved":
                    items_needing_validation.append({
                        "section": section_label,
                        "section_id": section_id,
                        "product": product,
                        "status": status,
                        "item_index": idx
                    })
        
        return len(items_needing_validation), items_needing_validation

    def extract_count_from_response(self, answer: str) -> Optional[int]:
        """Extract item count from response (e.g., '10 items', 'Total: 10', etc.)"""
        # Look for patterns like "10 items", "Total: 10", "10 articles", etc.
        patterns = [
            r'total[:\s]+(\d+)',
            r'(\d+)\s+items?',
            r'(\d+)\s+articles?',
            r'(\d+)\s+item',
            r'(\d+)\s+article',
        ]
        
        answer_lower = answer.lower()
        for pattern in patterns:
            matches = re.findall(pattern, answer_lower)
            if matches:
                try:
                    return int(matches[-1])  # Take the last match (usually the total)
                except ValueError:
                    continue
        
        return None

    def extract_items_from_response(self, answer: str) -> List[str]:
        """Extract product names from the response"""
        import re
        
        items = []
        # Look for bullet points with product names
        # Pattern: • Product Name — Status
        lines = answer.split('\n')
        for line in lines:
            # Remove bullet markers and extract product name
            line_clean = re.sub(r'^[\s•\-\*]+', '', line.strip())
            # Product name is usually before "—" or ":" or end of line
            if '—' in line_clean:
                product = line_clean.split('—')[0].strip()
            elif ':' in line_clean and not line_clean.startswith('**'):
                # Skip section headers
                product = line_clean.split(':')[0].strip()
            else:
                product = line_clean
            
            # Filter out section headers and totals
            if product and not any(skip in product.lower() for skip in [
                'items requiring', 'articles nécessitant', 'total', 'section'
            ]) and len(product) > 2:
                items.append(product)
        
        return items

    def test_validation_query(self, role: str, variant: str = "") -> TestResult:
        """Test VALIDATION query for a specific role"""
        test_name = f"VALIDATION - {role.upper()}{' - ' + variant if variant else ''}"
        start_time = datetime.now()

        try:
            # Variants of validation queries
            prompts = {
                "default": f"What needs to be validated by {role}?",
                "what_items_need": f"What items need to be validated by {role}?",
                "items_requiring": f"What items are requiring validation by {role}?",
                "show_validation": f"Show me items that need {role} validation",
                "validation_status": f"What is the validation status for {role}?",
            }

            prompt = prompts.get(variant, prompts["default"])

            # Get expected count and items from actual data
            expected_count, expected_items = self.count_items_needing_validation(role)
            expected_product_names = [item["product"] for item in expected_items]

            response = self.query_agent(prompt)
            answer = response.get("answer", "")

            # Basic validation
            passed = bool(answer and len(answer.strip()) > 0)

            # Check if answer mentions the role
            answer_lower = answer.lower()
            role_mentioned = role.lower() in answer_lower or (role == "cray" and "contractor" in answer_lower)

            # Check for validation-specific keywords
            has_validation_keywords = any(kw in answer_lower for kw in ["validation", "validate", "approval", "rejected", "pending", "change_order"])

            # Check if answer has structure (should have lists)
            has_structure = any(marker in answer for marker in ["•", "-", "*", "Items requiring", "Articles nécessitant"])

            # Extract count from response
            response_count = self.extract_count_from_response(answer)
            count_matches = response_count == expected_count if response_count is not None else False
            count_close = False
            if response_count is not None and expected_count > 0:
                # Allow some tolerance (within 10% or 2 items)
                count_close = abs(response_count - expected_count) <= max(2, expected_count * 0.1)

            # Extract items from response
            response_items = self.extract_items_from_response(answer)
            
            # Check if response contains at least some of the expected items
            # (We don't require all items, as the response might be formatted differently)
            items_found = 0
            if response_items and expected_product_names:
                # Check how many expected items appear in the response (case-insensitive)
                answer_lower_full = answer_lower
                for expected_product in expected_product_names:
                    if expected_product.lower() in answer_lower_full:
                        items_found += 1
                
                # We want at least 50% of items to be found, or at least 1 if there are few items
                min_items_required = max(1, int(len(expected_product_names) * 0.5))
                items_match = items_found >= min_items_required
            else:
                items_match = True  # If no items expected, any response is fine

            duration = (datetime.now() - start_time).total_seconds()

            # Determine if test passed
            test_passed = (
                passed and 
                role_mentioned and 
                has_validation_keywords and 
                has_structure and
                (count_matches or count_close) and
                items_match
            )

            message = "PASSED" if test_passed else "FAILED"
            issues = []
            if not passed:
                issues.append("empty response")
            if not role_mentioned:
                issues.append("role not mentioned")
            if not has_validation_keywords:
                issues.append("validation keywords missing")
            if not has_structure:
                issues.append("response lacks structure")
            if not count_matches and not count_close:
                if response_count is not None:
                    issues.append(f"count mismatch: expected {expected_count}, got {response_count}")
                else:
                    issues.append(f"count not found (expected {expected_count})")
            if not items_match:
                issues.append(f"items mismatch: found {items_found}/{len(expected_product_names)} expected items")
            
            if issues:
                message += " - " + ", ".join(issues)

            return TestResult(
                name=test_name,
                passed=test_passed,
                message=message,
                duration=duration,
                details={
                    "prompt": prompt,
                    "answer_length": len(answer),
                    "expected_count": expected_count,
                    "response_count": response_count,
                    "count_matches": count_matches or count_close,
                    "expected_items_count": len(expected_product_names),
                    "response_items_count": len(response_items),
                    "items_found": items_found,
                    "items_match": items_match,
                    "role_mentioned": role_mentioned,
                    "has_validation_keywords": has_validation_keywords,
                    "has_structure": has_structure,
                    "expected_items": expected_product_names[:10],  # First 10 for preview
                    "response_items": response_items[:10],  # First 10 for preview
                    "answer_preview": answer[:500] + "..." if len(answer) > 500 else answer
                }
            )

        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            return TestResult(
                name=test_name,
                passed=False,
                message=f"FAILED - Exception: {str(e)}",
                duration=duration,
                details={"error": str(e)}
            )

    def test_editing_pipeline(self) -> TestResult:
        """
        Test the editing materials pipeline with exact steps.
        This test modifies only the beegcat item and restores it to original state.
        """
        test_name = "EDITING MATERIALS - Pipeline Test"
        start_time = datetime.now()

        try:
            # Step 0: Backup and get original state
            backup_file = self.data_manager.backup("editing_pipeline")
            original_state = self.data_manager.get_beegcat_original_state()

            if not original_state:
                return TestResult(
                    name=test_name,
                    passed=False,
                    message="FAILED - Could not find beegcat item in cuisine section",
                    duration=(datetime.now() - start_time).total_seconds()
                )

            result = self.data_manager.get_beegcat_item()
            if not result:
                return TestResult(
                    name=test_name,
                    passed=False,
                    message="FAILED - Could not locate beegcat item",
                    duration=(datetime.now() - start_time).total_seconds()
                )

            section_id, item_index, _ = result
            steps_passed = []
            errors = []

            # Step 1: Modify reference number to 7438
            try:
                prompt1 = f"Modify the reference number to 7438 for the beegcat item in the cuisine section"
                response1 = self.query_agent(prompt1)
                # Verify the change
                data = self.data_manager.load()
                section = next((s for s in data['sections'] if s.get('id') == section_id), None)
                if section and section['items'][item_index].get('reference') == '7438':
                    steps_passed.append("Step 1: Set reference to 7438")
                else:
                    errors.append("Step 1: Reference not set to 7438")
            except Exception as e:
                errors.append(f"Step 1: Exception - {str(e)}")

            # Step 2: Modify reference back to null
            try:
                prompt2 = f"Modify the reference number back to null for the beegcat item in the cuisine section"
                response2 = self.query_agent(prompt2)
                # Verify the change
                data = self.data_manager.load()
                section = next((s for s in data['sections'] if s.get('id') == section_id), None)
                if section and section['items'][item_index].get('reference') is None:
                    steps_passed.append("Step 2: Set reference back to null")
                else:
                    errors.append("Step 2: Reference not set to null")
            except Exception as e:
                errors.append(f"Step 2: Exception - {str(e)}")

            # Step 3: Set client validation to "change_order" and cray validation to "rejected"
            try:
                prompt3 = f"Set client validation to 'change_order' and cray validation to 'rejected' for the beegcat item in the cuisine section"
                response3 = self.query_agent(prompt3)
                # Verify the changes
                data = self.data_manager.load()
                section = next((s for s in data['sections'] if s.get('id') == section_id), None)
                if section:
                    item = section['items'][item_index]
                    client_status = item.get('approvals', {}).get('client', {}).get('status')
                    cray_status = item.get('approvals', {}).get('cray', {}).get('status')
                    if client_status == 'change_order' and cray_status == 'rejected':
                        steps_passed.append("Step 3: Set client to change_order and cray to rejected")
                    else:
                        errors.append(f"Step 3: Client={client_status}, Cray={cray_status} (expected: change_order, rejected)")
            except Exception as e:
                errors.append(f"Step 3: Exception - {str(e)}")

            # Step 4: Set client validation to "approved" and cray validation back to null
            try:
                prompt4 = f"Set client validation to 'approved' and cray validation back to null for the beegcat item in the cuisine section"
                response4 = self.query_agent(prompt4)
                # Verify the changes
                data = self.data_manager.load()
                section = next((s for s in data['sections'] if s.get('id') == section_id), None)
                if section:
                    item = section['items'][item_index]
                    client_status = item.get('approvals', {}).get('client', {}).get('status')
                    cray_status = item.get('approvals', {}).get('cray', {}).get('status')
                    if client_status == 'approved' and cray_status is None:
                        steps_passed.append("Step 4: Set client to approved and cray to null")
                    else:
                        errors.append(f"Step 4: Client={client_status}, Cray={cray_status} (expected: approved, null)")
            except Exception as e:
                errors.append(f"Step 4: Exception - {str(e)}")

            # Final verification: Check if data matches original state
            final_data = self.data_manager.load()
            section = next((s for s in final_data['sections'] if s.get('id') == section_id), None)
            if section:
                final_item = section['items'][item_index]
                # Compare key fields that should be restored
                reference_match = final_item.get('reference') == original_state.get('reference')
                client_status_match = final_item.get('approvals', {}).get('client', {}).get('status') == original_state.get('approvals', {}).get('client', {}).get('status')
                cray_status_match = final_item.get('approvals', {}).get('cray', {}).get('status') == original_state.get('approvals', {}).get('cray', {}).get('status')

                if reference_match and client_status_match and cray_status_match:
                    steps_passed.append("Final: Data matches original state")
                else:
                    errors.append(f"Final: Data mismatch - Reference: {reference_match}, Client: {client_status_match}, Cray: {cray_status_match}")

            # Restore backup
            self.data_manager.restore(backup_file)

            # Verify restoration
            restored_data = self.data_manager.load()
            restored_section = next((s for s in restored_data['sections'] if s.get('id') == section_id), None)
            if restored_section:
                restored_item = restored_section['items'][item_index]
                restoration_verified = (
                    restored_item.get('reference') == original_state.get('reference') and
                    restored_item.get('approvals', {}).get('client', {}).get('status') == original_state.get('approvals', {}).get('client', {}).get('status') and
                    restored_item.get('approvals', {}).get('cray', {}).get('status') == original_state.get('approvals', {}).get('cray', {}).get('status')
                )
                if restoration_verified:
                    steps_passed.append("Restoration: Data successfully restored")
                else:
                    errors.append("Restoration: Data not properly restored")

            duration = (datetime.now() - start_time).total_seconds()
            passed = len(errors) == 0 and len(steps_passed) >= 5

            message = "PASSED" if passed else f"FAILED - {len(errors)} error(s)"
            if errors:
                message += f": {', '.join(errors[:3])}"  # Show first 3 errors

            return TestResult(
                name=test_name,
                passed=passed,
                message=message,
                duration=duration,
                details={
                    "steps_passed": steps_passed,
                    "errors": errors,
                    "original_state": original_state,
                    "backup_file": str(backup_file)
                }
            )

        except Exception as e:
            # Try to restore backup on error
            try:
                if 'backup_file' in locals():
                    self.data_manager.restore(backup_file)
            except:
                pass

            duration = (datetime.now() - start_time).total_seconds()
            return TestResult(
                name=test_name,
                passed=False,
                message=f"FAILED - Exception: {str(e)}",
                duration=duration,
                details={"error": str(e)}
            )

    def test_query_information(self, query_type: str, variant: str = "") -> TestResult:
        """Test QUERY/INFORMATION queries"""
        test_name = f"QUERY - {query_type.upper()}{' - ' + variant if variant else ''}"
        start_time = datetime.now()

        try:
            materials = self.data_manager.load()
            
            # Calculate expected values from data
            expected_values = {}
            
            if query_type == "pricing":
                # Calculate total cost
                total_ttc = 0
                total_ht = 0
                for section in materials.get('sections', []):
                    for item in section.get('items', []):
                        price = item.get('price', {})
                        if price.get('ttc'):
                            total_ttc += price.get('ttc', 0)
                        if price.get('htQuote'):
                            total_ht += price.get('htQuote', 0)
                expected_values['total_ttc'] = total_ttc
                expected_values['total_ht'] = total_ht
                
                prompts = {
                    "default": "What is the total cost?",
                    "total_price": "What's the total price?",
                    "total_ttc": "What's the total TTC?",
                    "total_ht": "What's the total HT?",
                }
                
            elif query_type == "timeline":
                # Count items with delivery dates
                items_with_delivery = []
                for section in materials.get('sections', []):
                    for item in section.get('items', []):
                        delivery = item.get('order', {}).get('delivery', {})
                        if delivery.get('date'):
                            items_with_delivery.append({
                                "product": item.get('product', ''),
                                "delivery_date": delivery.get('date')
                            })
                expected_values['items_with_delivery'] = len(items_with_delivery)
                
                prompts = {
                    "default": "What are the delivery dates?",
                    "delivery_schedule": "When will items be delivered?",
                    "delivery_timeline": "What's the delivery timeline?",
                }
                
            elif query_type == "section":
                # Count items in kitchen section
                kitchen_items = []
                for section in materials.get('sections', []):
                    if 'cuisine' in section.get('label', '').lower() or section.get('id', '').lower() == 'kitchen':
                        kitchen_items = [item.get('product', '') for item in section.get('items', [])]
                        break
                expected_values['kitchen_items_count'] = len(kitchen_items)
                expected_values['kitchen_items'] = kitchen_items
                
                prompts = {
                    "default": "Show me all items in the kitchen section",
                    "kitchen_items": "What items are in the cuisine?",
                    "list_kitchen": "List kitchen items",
                }
                
            elif query_type == "status":
                # Get status of a specific item (use beegcat if available)
                beegcat_status = None
                for section in materials.get('sections', []):
                    for item in section.get('items', []):
                        if item.get('product', '').lower() == 'beegcat':
                            beegcat_status = {
                                "client": item.get('approvals', {}).get('client', {}).get('status'),
                                "cray": item.get('approvals', {}).get('cray', {}).get('status'),
                                "ordered": item.get('order', {}).get('ordered', False)
                            }
                            break
                expected_values['beegcat_status'] = beegcat_status
                
                prompts = {
                    "default": "What's the status of the beegcat item?",
                    "beegcat_status": "What is beegcat's status?",
                }
            else:
                return TestResult(
                    name=test_name,
                    passed=False,
                    message="FAILED - Unknown query type",
                    duration=0,
                    details={"error": f"Unknown query type: {query_type}"}
                )

            prompt = prompts.get(variant, prompts["default"])
            response = self.query_agent(prompt)
            answer = response.get("answer", "")

            # Basic validation
            passed = bool(answer and len(answer.strip()) > 0)
            answer_lower = answer.lower()

            # Verify query-specific content against real data
            content_match = False
            value_match = False
            details_extra = {}
            
            if query_type == "pricing":
                # Check if answer mentions price/cost
                has_price_keywords = any(kw in answer_lower for kw in ["price", "cost", "ttc", "ht", "total", "€", "euro"])
                
                # Extract numbers from response (prices)
                numbers_str = re.findall(r'[\d,]+\.?\d*', answer.replace(',', ''))
                numbers = []
                for num_str in numbers_str:
                    try:
                        num = float(num_str.replace(',', ''))
                        numbers.append(num)
                    except ValueError:
                        pass
                
                # Check if any extracted number is close to expected total
                expected_ttc = expected_values.get('total_ttc', 0)
                expected_ht = expected_values.get('total_ht', 0)
                
                if numbers:
                    # Find closest match to expected values
                    ttc_match = any(abs(num - expected_ttc) < max(1, expected_ttc * 0.01) for num in numbers) if expected_ttc > 0 else False
                    ht_match = any(abs(num - expected_ht) < max(1, expected_ht * 0.01) for num in numbers) if expected_ht > 0 else False
                    value_match = ttc_match or ht_match or (expected_ttc == 0 and expected_ht == 0)
                    details_extra['expected_ttc'] = expected_ttc
                    details_extra['expected_ht'] = expected_ht
                    details_extra['extracted_numbers'] = numbers
                    details_extra['ttc_match'] = ttc_match
                    details_extra['ht_match'] = ht_match
                
                content_match = has_price_keywords and (value_match or len(numbers) > 0)
                
            elif query_type == "timeline":
                # Check if answer mentions delivery/dates
                has_timeline_keywords = any(kw in answer_lower for kw in ["delivery", "date", "timeline", "schedule", "when"])
                # Check for date patterns
                has_dates = bool(re.search(r'\d{2}/\d{2}', answer))
                
                # Count how many delivery dates are mentioned
                date_matches = re.findall(r'\d{2}/\d{2}', answer)
                expected_count = expected_values.get('items_with_delivery', 0)
                value_match = len(date_matches) >= expected_count * 0.5 if expected_count > 0 else (not has_dates or expected_count == 0)
                details_extra['expected_delivery_count'] = expected_count
                details_extra['date_matches_found'] = len(date_matches)
                
                content_match = has_timeline_keywords and (has_dates or expected_count == 0) and value_match
                
            elif query_type == "section":
                # Check if answer mentions kitchen/cuisine
                has_section_keywords = any(kw in answer_lower for kw in ["kitchen", "cuisine", "section"])
                # Check if expected items are mentioned
                expected_items = expected_values.get('kitchen_items', [])
                items_mentioned = sum(1 for item in expected_items if item.lower() in answer_lower)
                expected_count = expected_values.get('kitchen_items_count', 0)
                
                # At least 50% of items should be mentioned, or all if there are few
                min_items_required = max(1, int(expected_count * 0.5)) if expected_count > 0 else 0
                value_match = items_mentioned >= min_items_required or expected_count == 0
                details_extra['expected_items_count'] = expected_count
                details_extra['items_mentioned'] = items_mentioned
                details_extra['expected_items'] = expected_items[:10]  # First 10 for preview
                
                content_match = has_section_keywords and value_match
                
            elif query_type == "status":
                # Check if answer mentions status/approval
                has_status_keywords = any(kw in answer_lower for kw in ["status", "approval", "approved", "rejected", "pending"])
                if expected_values.get('beegcat_status'):
                    # Check if beegcat is mentioned
                    has_beegcat = "beegcat" in answer_lower
                    
                    # Check if the actual status values are mentioned
                    beegcat_status = expected_values.get('beegcat_status', {})
                    client_status = beegcat_status.get('client', '')
                    cray_status = beegcat_status.get('cray', '')
                    ordered = beegcat_status.get('ordered', False)
                    
                    # Check if status values appear in answer
                    status_mentioned = False
                    if client_status:
                        status_mentioned = client_status.lower() in answer_lower
                    if cray_status:
                        status_mentioned = status_mentioned or cray_status.lower() in answer_lower
                    if not status_mentioned and (client_status or cray_status):
                        # Try checking for "approved", "rejected", etc.
                        status_mentioned = any(status.lower() in answer_lower for status in [client_status, cray_status] if status)
                    
                    value_match = has_beegcat and (status_mentioned or not (client_status or cray_status))
                    details_extra['expected_status'] = beegcat_status
                    details_extra['status_mentioned'] = status_mentioned
                    
                    content_match = has_status_keywords and has_beegcat and value_match
                else:
                    content_match = has_status_keywords
                    value_match = True  # No specific status to verify

            duration = (datetime.now() - start_time).total_seconds()
            test_passed = passed and content_match and value_match

            message = "PASSED" if test_passed else "FAILED"
            issues = []
            if not passed:
                issues.append("empty response")
            if not content_match:
                issues.append("content doesn't match query type")
            if not value_match:
                issues.append("values don't match expected data")

            if issues:
                message += " - " + ", ".join(issues)

            return TestResult(
                name=test_name,
                passed=test_passed,
                message=message,
                duration=duration,
                details={
                    "prompt": prompt,
                    "query_type": query_type,
                    "expected_values": expected_values,
                    "answer_length": len(answer),
                    "content_match": content_match,
                    "value_match": value_match,
                    **details_extra,
                    "answer_preview": answer[:300] + "..." if len(answer) > 300 else answer
                }
            )

        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            return TestResult(
                name=test_name,
                passed=False,
                message=f"FAILED - Exception: {str(e)}",
                duration=duration,
                details={"error": str(e)}
            )

    def test_array_operations(self, operation: str) -> TestResult:
        """Test ARRAY OPERATIONS (adding/removing replacementUrls)"""
        test_name = f"ARRAY OPERATIONS - {operation.upper()}"
        start_time = datetime.now()

        try:
            # Use beegcat item for testing
            result = self.data_manager.get_beegcat_item()
            if not result:
                return TestResult(
                    name=test_name,
                    passed=False,
                    message="FAILED - Could not find beegcat item",
                    duration=(datetime.now() - start_time).total_seconds()
                )

            section_id, item_index, original_item = result
            backup_file = self.data_manager.backup(f"array_ops_{operation}")

            # Get current replacementUrls
            current_urls = original_item.get('approvals', {}).get('client', {}).get('replacementUrls', [])
            if not isinstance(current_urls, list):
                current_urls = []

            test_url = "test-url-12345-unique"
            steps_passed = []
            errors = []

            if operation == "add":
                # Test adding a URL
                if test_url in current_urls:
                    # Remove it first if it exists
                    prompt_remove = f"Remove the replacement URL '{test_url}' from the beegcat item in the cuisine section"
                    try:
                        self.query_agent(prompt_remove)
                        # Reload to get updated state
                        data = self.data_manager.load()
                        section = next((s for s in data['sections'] if s.get('id') == section_id), None)
                        if section:
                            current_urls = section['items'][item_index].get('approvals', {}).get('client', {}).get('replacementUrls', [])
                    except:
                        pass

                prompt = f"Add the replacement URL '{test_url}' to the beegcat item in the cuisine section"
                response = self.query_agent(prompt)

                # Verify the URL was added
                data = self.data_manager.load()
                section = next((s for s in data['sections'] if s.get('id') == section_id), None)
                if section:
                    updated_urls = section['items'][item_index].get('approvals', {}).get('client', {}).get('replacementUrls', [])
                    if test_url in updated_urls:
                        steps_passed.append(f"URL '{test_url}' added successfully")
                        # Verify other URLs are preserved
                        preserved_count = sum(1 for url in current_urls if url in updated_urls)
                        if preserved_count == len(current_urls):
                            steps_passed.append("All existing URLs preserved")
                        else:
                            errors.append(f"Only {preserved_count}/{len(current_urls)} existing URLs preserved")
                    else:
                        errors.append(f"URL '{test_url}' not found after add operation")

            elif operation == "remove":
                # Test removing a URL (use first existing URL if available)
                if len(current_urls) == 0:
                    # Add a URL first
                    test_url_to_remove = "temp-url-to-remove-12345"
                    prompt_add = f"Add the replacement URL '{test_url_to_remove}' to the beegcat item in the cuisine section"
                    self.query_agent(prompt_add)
                    # Reload
                    data = self.data_manager.load()
                    section = next((s for s in data['sections'] if s.get('id') == section_id), None)
                    if section:
                        current_urls = section['items'][item_index].get('approvals', {}).get('client', {}).get('replacementUrls', [])
                        test_url = test_url_to_remove

                if len(current_urls) > 0:
                    url_to_remove = current_urls[0] if test_url not in current_urls else test_url
                    prompt = f"Remove the replacement URL '{url_to_remove}' from the beegcat item in the cuisine section"
                    response = self.query_agent(prompt)

                    # Verify the URL was removed
                    data = self.data_manager.load()
                    section = next((s for s in data['sections'] if s.get('id') == section_id), None)
                    if section:
                        updated_urls = section['items'][item_index].get('approvals', {}).get('client', {}).get('replacementUrls', [])
                        if url_to_remove not in updated_urls:
                            steps_passed.append(f"URL '{url_to_remove}' removed successfully")
                            # Verify other URLs are preserved
                            other_urls = [url for url in current_urls if url != url_to_remove]
                            preserved_count = sum(1 for url in other_urls if url in updated_urls)
                            if preserved_count == len(other_urls):
                                steps_passed.append("All other URLs preserved")
                            else:
                                errors.append(f"Only {preserved_count}/{len(other_urls)} other URLs preserved")
                        else:
                            errors.append(f"URL '{url_to_remove}' still present after remove operation")
                else:
                    errors.append("No URLs available to test removal")

            # Restore backup
            self.data_manager.restore(backup_file)

            duration = (datetime.now() - start_time).total_seconds()
            passed = len(errors) == 0 and len(steps_passed) > 0

            message = "PASSED" if passed else f"FAILED - {len(errors)} error(s)"
            if errors:
                message += f": {', '.join(errors)}"

            return TestResult(
                name=test_name,
                passed=passed,
                message=message,
                duration=duration,
                details={
                    "operation": operation,
                    "steps_passed": steps_passed,
                    "errors": errors,
                    "backup_file": str(backup_file)
                }
            )

        except Exception as e:
            # Try to restore backup
            try:
                if 'backup_file' in locals():
                    self.data_manager.restore(backup_file)
            except:
                pass

            duration = (datetime.now() - start_time).total_seconds()
            return TestResult(
                name=test_name,
                passed=False,
                message=f"FAILED - Exception: {str(e)}",
                duration=duration,
                details={"error": str(e)}
            )

    def test_confirmation_handling(self, scenario: str) -> TestResult:
        """Test CONFIRMATION HANDLING when multiple items match"""
        test_name = f"CONFIRMATION - {scenario.upper()}"
        start_time = datetime.now()

        try:
            materials = self.data_manager.load()
            
            # Find items that would match a common identifier
            # Look for items with similar product names or in same section
            test_scenarios = {
                "multiple_matches": None,
                "single_match": None,
                "no_matches": None
            }

            # Find a product that appears multiple times, or create a test scenario
            product_counts = {}
            for section in materials.get('sections', []):
                for item in section.get('items', []):
                    product = item.get('product', '').lower()
                    if product:
                        product_counts[product] = product_counts.get(product, 0) + 1

            # Find a product with multiple matches
            multi_match_product = None
            for product, count in product_counts.items():
                if count > 1:
                    multi_match_product = product
                    break

            response = {"answer": ""}  # Initialize response
            
            if scenario == "multiple_matches" and multi_match_product:
                # Test that agent asks for confirmation
                prompt = f"Validate the {multi_match_product} item as client"
                response = self.query_agent(prompt)
                answer = response.get("answer", "").lower()
                
                # Check if agent asks for confirmation
                asks_confirmation = any(phrase in answer for phrase in [
                    "found", "multiple", "items", "which", "specify", "all", "confirm"
                ])
                
                # Should NOT have updated immediately (no success message)
                updated_immediately = any(phrase in answer for phrase in [
                    "successfully", "updated", "validated", "approved"
                ])
                
                passed = asks_confirmation and not updated_immediately
                message = "PASSED" if passed else "FAILED"
                if not asks_confirmation:
                    message += " - Agent did not ask for confirmation"
                if updated_immediately:
                    message += " - Agent updated without confirmation"

            elif scenario == "all_confirmation":
                # Test handling "all" confirmation
                if multi_match_product:
                    # First, trigger the confirmation request
                    prompt1 = f"Validate the {multi_match_product} item as client"
                    response = self.query_agent(prompt1)
                    
                    # Then confirm with "all"
                    prompt2 = "all of them"
                    # Note: This requires conversation context, which may not work via API
                    # For now, we'll test that the first response asks for confirmation
                    answer1 = response.get("answer", "").lower()
                    asks_confirmation = any(phrase in answer1 for phrase in [
                        "found", "multiple", "items", "which", "specify", "all"
                    ])
                    passed = asks_confirmation
                    message = "PASSED" if passed else "FAILED - Confirmation not requested"
                else:
                    passed = False
                    message = "FAILED - No multiple matches found to test"
                    response = {"answer": ""}

            elif scenario == "single_match":
                # Test that single match updates immediately (no confirmation needed)
                # Use beegcat which should be unique
                prompt = "Validate the beegcat item as client"
                response = self.query_agent(prompt)
                answer = response.get("answer", "").lower()
                
                # Should update immediately, not ask for confirmation
                asks_confirmation = any(phrase in answer for phrase in [
                    "found", "multiple", "which", "specify"
                ])
                updated = any(phrase in answer for phrase in [
                    "successfully", "updated", "validated", "approved"
                ])
                
                passed = updated and not asks_confirmation
                message = "PASSED" if passed else "FAILED"
                if asks_confirmation:
                    message += " - Asked for confirmation when not needed"
                if not updated:
                    message += " - Did not update single match"

            else:
                passed = False
                message = f"FAILED - Unknown scenario: {scenario}"

            duration = (datetime.now() - start_time).total_seconds()

            return TestResult(
                name=test_name,
                passed=passed,
                message=message,
                duration=duration,
                details={
                    "scenario": scenario,
                    "answer_preview": response.get("answer", "")[:300] + "..." if len(response.get("answer", "")) > 300 else response.get("answer", "")
                }
            )

        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            return TestResult(
                name=test_name,
                passed=False,
                message=f"FAILED - Exception: {str(e)}",
                duration=duration,
                details={"error": str(e)}
            )

    def test_bilingual_response(self, query_type: str) -> TestResult:
        """Test BILINGUAL RESPONSE (English and French)"""
        test_name = f"BILINGUAL - {query_type.upper()}"
        start_time = datetime.now()

        try:
            prompts = {
                "validation": "What needs to be validated by client?",
                "todo": "What needs to be done today as client?",
                "pricing": "What is the total cost?",
            }

            prompt = prompts.get(query_type, prompts["validation"])
            response = self.query_agent(prompt)
            
            answer_en = response.get("answer", "")
            answer_fr = response.get("answer_fr", "")

            # Check both languages are present
            has_english = bool(answer_en and len(answer_en.strip()) > 0)
            has_french = bool(answer_fr and len(answer_fr.strip()) > 0)

            # Check if answer contains both languages (some responses include both)
            answer_combined = answer_en + " " + answer_fr
            has_both_in_one = "EN:" in answer_en or "FR:" in answer_en or "English" in answer_en or "Français" in answer_en

            # Check French keywords
            french_keywords = ["articles", "nécessitant", "validation", "total", "items"]
            has_french_keywords = any(kw in answer_fr.lower() for kw in french_keywords) if answer_fr else False

            # Check if content is similar (both should have similar structure)
            has_structure_en = any(marker in answer_en for marker in ["•", "-", "*", "Items", "Total"])
            has_structure_fr = any(marker in answer_fr for marker in ["•", "-", "*", "Articles", "Total"]) if answer_fr else False

            duration = (datetime.now() - start_time).total_seconds()

            # Test passes if we have both languages OR if the response contains both
            test_passed = (has_english and has_french) or (has_english and has_both_in_one)
            
            message = "PASSED" if test_passed else "FAILED"
            issues = []
            if not has_english:
                issues.append("missing English")
            if not has_french and not has_both_in_one:
                issues.append("missing French")
            if has_french and not has_french_keywords:
                issues.append("French may not be valid")
            if not has_structure_en:
                issues.append("English lacks structure")
            if has_french and not has_structure_fr:
                issues.append("French lacks structure")

            if issues:
                message += " - " + ", ".join(issues)

            return TestResult(
                name=test_name,
                passed=test_passed,
                message=message,
                duration=duration,
                details={
                    "query_type": query_type,
                    "has_english": has_english,
                    "has_french": has_french,
                    "has_both_in_one": has_both_in_one,
                    "has_french_keywords": has_french_keywords,
                    "has_structure_en": has_structure_en,
                    "has_structure_fr": has_structure_fr,
                    "answer_en_preview": answer_en[:200] + "..." if len(answer_en) > 200 else answer_en,
                    "answer_fr_preview": answer_fr[:200] + "..." if len(answer_fr) > 200 else answer_fr
                }
            )

        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            return TestResult(
                name=test_name,
                passed=False,
                message=f"FAILED - Exception: {str(e)}",
                duration=duration,
                details={"error": str(e)}
            )

    def test_error_handling(self, error_type: str) -> TestResult:
        """Test ERROR HANDLING with invalid inputs"""
        test_name = f"ERROR HANDLING - {error_type.upper()}"
        start_time = datetime.now()

        try:
            prompts = {
                "nonexistent_item": "Validate the nonexistent-item-xyz-12345 item as client",
                "invalid_field": "Set the invalid_field_xyz to 'test' for the beegcat item",
                "invalid_value": "Set the client validation to 'invalid_status_xyz' for the beegcat item",
                "malformed_request": "Validate as client",  # Missing item name
            }

            prompt = prompts.get(error_type, prompts["nonexistent_item"])
            response = self.query_agent(prompt)
            answer = response.get("answer", "").lower()

            # Check if agent handles error gracefully
            # Should NOT claim success, should indicate error or ask for clarification
            claims_success = any(phrase in answer for phrase in [
                "successfully", "updated", "validated", "approved", "done"
            ])
            
            indicates_error = any(phrase in answer for phrase in [
                "not found", "couldn't find", "doesn't exist", "invalid", "error", "unable", "cannot",
                "clarify", "specify", "which", "please provide"
            ])

            duration = (datetime.now() - start_time).total_seconds()

            # Test passes if agent doesn't claim success and indicates error/clarification needed
            test_passed = not claims_success and (indicates_error or len(answer) == 0)
            
            message = "PASSED" if test_passed else "FAILED"
            issues = []
            if claims_success:
                issues.append("claimed success for invalid input")
            if not indicates_error and len(answer) > 0:
                issues.append("did not indicate error or need for clarification")

            if issues:
                message += " - " + ", ".join(issues)

            return TestResult(
                name=test_name,
                passed=test_passed,
                message=message,
                duration=duration,
                details={
                    "error_type": error_type,
                    "prompt": prompt,
                    "claims_success": claims_success,
                    "indicates_error": indicates_error,
                    "answer_preview": answer[:300] + "..." if len(answer) > 300 else answer
                }
            )

        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            return TestResult(
                name=test_name,
                passed=False,
                message=f"FAILED - Exception: {str(e)}",
                duration=duration,
                details={"error": str(e)}
            )


def run_test_suite(categories: Optional[Set[str]] = None, priority_only: bool = False) -> TestSuite:
    """Run the complete test suite
    
    Args:
        categories: Set of category names to run (None = all categories)
        priority_only: If True, run only high-priority tests
    """
    suite = TestSuite(name="Agent Test Suite")
    suite.start_time = datetime.now()

    tester = AgentTester()

    # Define category mappings
    category_map = {
        "todo": "TODO",
        "validation": "VALIDATION",
        "editing": "EDITING",
        "query": "QUERY",
        "array": "ARRAY",
        "confirmation": "CONFIRMATION",
        "bilingual": "BILINGUAL",
        "error": "ERROR"
    }
    
    # High-priority categories (core functionality)
    high_priority_categories = {"validation", "editing", "array"}
    
    # Determine which categories to run
    if priority_only:
        categories_to_run = high_priority_categories
        print("=" * 80)
        print("AGENT TEST SUITE - HIGH PRIORITY MODE")
        print("=" * 80)
    elif categories:
        categories_to_run = {c.lower() for c in categories}
        print("=" * 80)
        print(f"AGENT TEST SUITE - SELECTED CATEGORIES: {', '.join(categories_to_run)}")
        print("=" * 80)
    else:
        categories_to_run = None  # Run all
        print("=" * 80)
        print("AGENT TEST SUITE")
        print("=" * 80)
    print()

    roles = ["client", "contractor", "architect"]
    variants = ["default", "what_do_i_need", "what_are_my_tasks", "what_should_i_do", "action_items"]
    
    # Limit variants for priority mode
    if priority_only:
        variants = ["default"]  # Only run default variant for priority mode

    # TODO Tests
    if categories_to_run is None or "todo" in categories_to_run:
        print("Running TODO tests...")
        for role in roles:
            for variant in variants:
                result = tester.test_todo_query(role, variant)
                suite.add_result(result)
                status = "✓" if result.passed else "✗"
                print(f"  {status} {result.name} ({result.duration:.2f}s) - {result.message}")
        print()

    # VALIDATION Tests
    if categories_to_run is None or "validation" in categories_to_run:
        print("Running VALIDATION tests...")
        for role in roles:
            for variant in variants:
                result = tester.test_validation_query(role, variant)
                suite.add_result(result)
                status = "✓" if result.passed else "✗"
                print(f"  {status} {result.name} ({result.duration:.2f}s) - {result.message}")
        print()

    # EDITING MATERIALS Pipeline Test
    if categories_to_run is None or "editing" in categories_to_run:
        print("Running EDITING MATERIALS pipeline test...")
        result = tester.test_editing_pipeline()
        suite.add_result(result)
        status = "✓" if result.passed else "✗"
        print(f"  {status} {result.name} ({result.duration:.2f}s) - {result.message}")
        if result.details.get("steps_passed"):
            print("    Steps passed:")
            for step in result.details["steps_passed"]:
                print(f"      ✓ {step}")
        if result.details.get("errors"):
            print("    Errors:")
            for error in result.details["errors"]:
                print(f"      ✗ {error}")
        print()

    # QUERY/INFORMATION Tests
    if categories_to_run is None or "query" in categories_to_run:
        print("Running QUERY/INFORMATION tests...")
        query_types = ["pricing", "timeline", "section", "status"]
        query_variants = {
            "pricing": ["default", "total_price", "total_ttc", "total_ht"],
            "timeline": ["default", "delivery_schedule", "delivery_timeline"],
            "section": ["default", "kitchen_items", "list_kitchen"],
            "status": ["default", "beegcat_status"],
        }
        # Limit variants for priority mode
        if priority_only:
            query_variants = {k: ["default"] for k in query_variants}
        
        for query_type in query_types:
            variants = query_variants.get(query_type, ["default"])
            for variant in variants:
                result = tester.test_query_information(query_type, variant)
                suite.add_result(result)
                status = "✓" if result.passed else "✗"
                print(f"  {status} {result.name} ({result.duration:.2f}s) - {result.message}")
        print()

    # ARRAY OPERATIONS Tests
    if categories_to_run is None or "array" in categories_to_run:
        print("Running ARRAY OPERATIONS tests...")
        for operation in ["add", "remove"]:
            result = tester.test_array_operations(operation)
            suite.add_result(result)
            status = "✓" if result.passed else "✗"
            print(f"  {status} {result.name} ({result.duration:.2f}s) - {result.message}")
            if result.details.get("steps_passed"):
                print("    Steps passed:")
                for step in result.details["steps_passed"]:
                    print(f"      ✓ {step}")
            if result.details.get("errors"):
                print("    Errors:")
                for error in result.details["errors"]:
                    print(f"      ✗ {error}")
        print()

    # CONFIRMATION HANDLING Tests
    if categories_to_run is None or "confirmation" in categories_to_run:
        print("Running CONFIRMATION HANDLING tests...")
        confirmation_scenarios = ["multiple_matches", "all_confirmation", "single_match"]
        if priority_only:
            confirmation_scenarios = ["multiple_matches"]  # Most important scenario
        for scenario in confirmation_scenarios:
            result = tester.test_confirmation_handling(scenario)
            suite.add_result(result)
            status = "✓" if result.passed else "✗"
            print(f"  {status} {result.name} ({result.duration:.2f}s) - {result.message}")
        print()

    # BILINGUAL RESPONSE Tests
    if categories_to_run is None or "bilingual" in categories_to_run:
        print("Running BILINGUAL RESPONSE tests...")
        bilingual_query_types = ["validation", "todo", "pricing"]
        if priority_only:
            bilingual_query_types = ["validation"]  # Most important query type
        for query_type in bilingual_query_types:
            result = tester.test_bilingual_response(query_type)
            suite.add_result(result)
            status = "✓" if result.passed else "✗"
            print(f"  {status} {result.name} ({result.duration:.2f}s) - {result.message}")
        print()

    # ERROR HANDLING Tests
    if categories_to_run is None or "error" in categories_to_run:
        print("Running ERROR HANDLING tests...")
        error_types = ["nonexistent_item", "invalid_field", "invalid_value", "malformed_request"]
        if priority_only:
            error_types = ["nonexistent_item", "malformed_request"]  # Most important error types
        for error_type in error_types:
            result = tester.test_error_handling(error_type)
            suite.add_result(result)
            status = "✓" if result.passed else "✗"
            print(f"  {status} {result.name} ({result.duration:.2f}s) - {result.message}")
        print()

    suite.end_time = datetime.now()
    return suite


def print_summary(suite: TestSuite):
    """Print test suite summary"""
    summary = suite.get_summary()

    print("=" * 80)
    print("TEST SUITE SUMMARY")
    print("=" * 80)
    print(f"Suite: {summary['name']}")
    print(f"Total Tests: {summary['total']}")
    print(f"Passed: {summary['passed']}")
    print(f"Failed: {summary['failed']}")
    print(f"Success Rate: {summary['success_rate']:.1f}%")
    print(f"Duration: {summary['duration']:.2f}s")
    print()

    # Group by category
    todo_results = [r for r in suite.results if r.name.startswith("TODO")]
    validation_results = [r for r in suite.results if r.name.startswith("VALIDATION")]
    editing_results = [r for r in suite.results if r.name.startswith("EDITING")]
    query_results = [r for r in suite.results if r.name.startswith("QUERY")]
    array_results = [r for r in suite.results if r.name.startswith("ARRAY")]
    confirmation_results = [r for r in suite.results if r.name.startswith("CONFIRMATION")]
    bilingual_results = [r for r in suite.results if r.name.startswith("BILINGUAL")]
    error_results = [r for r in suite.results if r.name.startswith("ERROR")]

    print("By Category:")
    print(f"  TODO: {sum(1 for r in todo_results if r.passed)}/{len(todo_results)} passed")
    print(f"  VALIDATION: {sum(1 for r in validation_results if r.passed)}/{len(validation_results)} passed")
    print(f"  EDITING: {sum(1 for r in editing_results if r.passed)}/{len(editing_results)} passed")
    print(f"  QUERY: {sum(1 for r in query_results if r.passed)}/{len(query_results)} passed")
    print(f"  ARRAY OPERATIONS: {sum(1 for r in array_results if r.passed)}/{len(array_results)} passed")
    print(f"  CONFIRMATION: {sum(1 for r in confirmation_results if r.passed)}/{len(confirmation_results)} passed")
    print(f"  BILINGUAL: {sum(1 for r in bilingual_results if r.passed)}/{len(bilingual_results)} passed")
    print(f"  ERROR HANDLING: {sum(1 for r in error_results if r.passed)}/{len(error_results)} passed")
    print()

    # Show failed tests
    failed = [r for r in suite.results if not r.passed]
    if failed:
        print("Failed Tests:")
        for result in failed:
            print(f"  ✗ {result.name}: {result.message}")
        print()

    print("=" * 80)


def estimate_cost(categories: Optional[Set[str]] = None, priority_only: bool = False) -> Dict[str, Any]:
    """
    Estimate the cost of running the test suite.
    
    Pricing (GPT-4o as of 2024):
    - Input: $0.03 per 1,000 tokens ($30 per 1M tokens)
    - Output: $0.06 per 1,000 tokens ($60 per 1M tokens)
    
    Token estimates per API call:
    - Input: ~8,000 tokens (system prompt + materials data + user prompt)
    - Output: ~400 tokens average (varies by test type)
    """
    # Count API calls per category
    roles = ["client", "contractor", "architect"]
    variants_full = ["default", "what_do_i_need", "what_are_my_tasks", "what_should_i_do", "action_items"]
    variants_priority = ["default"]
    
    variants = variants_priority if priority_only else variants_full
    
    category_calls = {
        "todo": len(roles) * len(variants),
        "validation": len(roles) * len(variants),
        "editing": 4,  # 4 steps in the pipeline
        "query": 4 if priority_only else 12,  # 4 types × variants
        "array": 2,  # add + remove
        "confirmation": 1 if priority_only else 3,
        "bilingual": 1 if priority_only else 3,
        "error": 2 if priority_only else 4,
    }
    
    # Determine which categories to count
    if priority_only:
        categories_to_count = {"validation", "editing", "array"}
    elif categories:
        categories_to_count = {c.lower() for c in categories}
    else:
        categories_to_count = set(category_calls.keys())
    
    # Count total API calls
    total_calls = sum(category_calls.get(cat, 0) for cat in categories_to_count)
    
    # Token estimates per call
    input_tokens_per_call = 8000  # System prompt + materials data + user prompt
    output_tokens_per_call = 400  # Average response length
    
    # Calculate total tokens
    total_input_tokens = total_calls * input_tokens_per_call
    total_output_tokens = total_calls * output_tokens_per_call
    
    # Calculate costs (pricing as of 2024)
    input_cost_per_1k = 0.03
    output_cost_per_1k = 0.06
    
    input_cost = (total_input_tokens / 1000) * input_cost_per_1k
    output_cost = (total_output_tokens / 1000) * output_cost_per_1k
    total_cost = input_cost + output_cost
    
    # Per-category breakdown
    category_costs = {}
    for cat in categories_to_count:
        calls = category_calls.get(cat, 0)
        cat_input_tokens = calls * input_tokens_per_call
        cat_output_tokens = calls * output_tokens_per_call
        cat_input_cost = (cat_input_tokens / 1000) * input_cost_per_1k
        cat_output_cost = (cat_output_tokens / 1000) * output_cost_per_1k
        category_costs[cat] = {
            "calls": calls,
            "cost": cat_input_cost + cat_output_cost,
            "input_tokens": cat_input_tokens,
            "output_tokens": cat_output_tokens
        }
    
    return {
        "total_calls": total_calls,
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
        "input_cost": input_cost,
        "output_cost": output_cost,
        "total_cost": total_cost,
        "category_costs": category_costs,
        "categories": list(categories_to_count)
    }


def print_cost_estimate(categories: Optional[Set[str]] = None, priority_only: bool = False):
    """Print cost estimate before running tests"""
    estimate = estimate_cost(categories, priority_only)
    
    print("=" * 80)
    print("COST ESTIMATE")
    print("=" * 80)
    print(f"Mode: {'Priority' if priority_only else 'Full' if categories is None else 'Selective'}")
    print(f"Categories: {', '.join(estimate['categories']) if estimate['categories'] else 'all'}")
    print()
    print(f"Total API Calls: {estimate['total_calls']}")
    print(f"Estimated Input Tokens: {estimate['total_input_tokens']:,}")
    print(f"Estimated Output Tokens: {estimate['total_output_tokens']:,}")
    print()
    print(f"Input Cost:  ${estimate['input_cost']:.2f}")
    print(f"Output Cost: ${estimate['output_cost']:.2f}")
    print(f"{'=' * 40}")
    print(f"TOTAL ESTIMATED COST: ${estimate['total_cost']:.2f}")
    print("=" * 80)
    print()
    
    if estimate['category_costs']:
        print("Cost Breakdown by Category:")
        for cat, costs in estimate['category_costs'].items():
            print(f"  {cat:15} {costs['calls']:3} calls  ${costs['cost']:.2f}")
        print()
    
    print("Note: Actual costs may vary based on:")
    print("  - Actual response lengths (output tokens)")
    print("  - Materials data size (input tokens)")
    print("  - Model pricing changes")
    print("=" * 80)
    print()


def parse_arguments():
    """Parse command-line arguments"""
    parser = argparse.ArgumentParser(
        description="Agent Test Suite for France Renovation Contractor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run all tests
  python3 tests/agent_test_suite.py

  # Run only high-priority tests (faster)
  python3 tests/agent_test_suite.py --priority

  # Run specific categories
  python3 tests/agent_test_suite.py --categories validation editing

  # Run multiple categories
  python3 tests/agent_test_suite.py --categories validation array error

  # Estimate cost before running
  python3 tests/agent_test_suite.py --estimate-cost

Available categories:
  todo, validation, editing, query, array, confirmation, bilingual, error
        """
    )
    
    parser.add_argument(
        "--categories", "-c",
        nargs="+",
        choices=["todo", "validation", "editing", "query", "array", "confirmation", "bilingual", "error"],
        help="Run only specified test categories"
    )
    
    parser.add_argument(
        "--priority", "-p",
        action="store_true",
        help="Run only high-priority tests (validation, editing, array operations)"
    )
    
    parser.add_argument(
        "--list-categories",
        action="store_true",
        help="List all available test categories and exit"
    )
    
    parser.add_argument(
        "--estimate-cost",
        action="store_true",
        help="Estimate cost and exit without running tests"
    )
    
    parser.add_argument(
        "--skip-cost-warning",
        action="store_true",
        help="Skip cost estimate warning (use with caution)"
    )
    
    return parser.parse_args()


if __name__ == "__main__":
    try:
        args = parse_arguments()
        
        if args.list_categories:
            print("Available test categories:")
            print("  todo         - TODO tests (what needs to be done)")
            print("  validation   - VALIDATION tests (what needs validation)")
            print("  editing      - EDITING MATERIALS tests (editing pipeline)")
            print("  query        - QUERY/INFORMATION tests (pricing, timeline, etc.)")
            print("  array        - ARRAY OPERATIONS tests (add/remove URLs)")
            print("  confirmation - CONFIRMATION HANDLING tests (multiple matches)")
            print("  bilingual    - BILINGUAL RESPONSE tests (English/French)")
            print("  error        - ERROR HANDLING tests (invalid inputs)")
            print()
            print("High-priority categories (core functionality):")
            print("  validation, editing, array")
            sys.exit(0)
        
        categories = set(args.categories) if args.categories else None
        priority_only = args.priority
        
        if priority_only and categories:
            print("Warning: --priority and --categories cannot be used together.")
            print("Using --priority mode.")
            categories = None
        
        # Show cost estimate
        if args.estimate_cost:
            print_cost_estimate(categories=categories, priority_only=priority_only)
            sys.exit(0)
        
        # Show cost estimate and ask for confirmation (unless skipped)
        if not args.skip_cost_warning:
            print_cost_estimate(categories=categories, priority_only=priority_only)
            print("⚠️  WARNING: This will make API calls that cost money!")
            print()
            response = input("Do you want to continue? (yes/no): ").strip().lower()
            if response not in ['yes', 'y']:
                print("Test suite cancelled.")
                sys.exit(0)
            print()
        
        suite = run_test_suite(categories=categories, priority_only=priority_only)
        print_summary(suite)

        # Exit with appropriate code
        summary = suite.get_summary()
        sys.exit(0 if summary['failed'] == 0 else 1)

    except KeyboardInterrupt:
        print("\n\nTest suite interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

