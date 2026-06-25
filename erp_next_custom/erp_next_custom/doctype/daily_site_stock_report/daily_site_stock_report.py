import frappe
from frappe.model.document import Document
from frappe.utils import flt


class DailySiteStockReport(Document):
    def validate(self):
        self.set_status()
        self.calculate_rows()
        self.calculate_totals()

    def before_submit(self):
        self.report_status = "Submitted"

    def on_cancel(self):
        self.report_status = "Cancelled"

    def set_status(self):
        if self.docstatus == 0:
            self.report_status = "Draft"
        elif self.docstatus == 1:
            self.report_status = "Submitted"
        elif self.docstatus == 2:
            self.report_status = "Cancelled"

    def calculate_rows(self):
        for row in self.items:
            if row.item_code:
                item = frappe.db.get_value(
                    "Item",
                    row.item_code,
                    ["item_name", "stock_uom"],
                    as_dict=True,
                )

                if item:
                    row.item_name = item.item_name
                    row.uom = item.stock_uom

            row.closing_qty = (
                flt(row.opening_qty)
                + flt(row.in_qty)
                - flt(row.out_qty)
                - flt(row.damaged_lost_qty)
            )

            row.difference_qty = flt(row.physical_count_qty) - flt(row.closing_qty)

    def calculate_totals(self):
        self.total_opening_qty = sum(flt(row.opening_qty) for row in self.items)
        self.total_in_qty = sum(flt(row.in_qty) for row in self.items)
        self.total_out_qty = sum(flt(row.out_qty) for row in self.items)
        self.total_damaged_lost_qty = sum(flt(row.damaged_lost_qty) for row in self.items)
        self.total_closing_qty = sum(flt(row.closing_qty) for row in self.items)
