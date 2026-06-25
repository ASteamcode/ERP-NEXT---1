"""
Old patch disabled.

This file used to create Stock Entry custom fields directly.
That caused duplicates because Stock Entry customization is now controlled from:

erp_next_custom/customize/stock_entry.py

Do not create Stock Entry fields here.
Keep this file because it may still be referenced in patches.txt.
"""


def execute():
    pass
