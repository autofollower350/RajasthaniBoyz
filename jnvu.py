import asyncio
import os
import sys
import nest_asyncio
import fitz  # PyMuPDF
import re
from playwright.async_api import async_playwright

nest_asyncio.apply()

async def download_jnvu_pdf(form_number):
    pdf_path = f"admit_card_{form_number}.pdf"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()
        
        # Speed ke liye faltu cheezein block
        await page.route("**/*.{png,jpg,jpeg,gif,css,woff2}", lambda route: route.abort())
        url = "https://erp.jnvuiums.in/(S(biolzjtwlrcfmzwwzgs5uj5n))/Exam/Pre_Exam/Exam_ForALL_AdmitCard.aspx#"

        try:
            await page.goto(url, wait_until="commit", timeout=30000)
            await page.fill("#txtchallanNo", str(form_number))
            submit_btn = page.locator("#btnGetResult")

            async with page.expect_download(timeout=15000) as download_info:
                await submit_btn.click()
                await asyncio.sleep(1) # Chhota delay stable connection ke liye
                await submit_btn.click()

            download = await download_info.value
            await download.save_as(pdf_path)
            await browser.close()
            return pdf_path
        except Exception as e:
            print(f"Error: {e}")
            await browser.close()
            return None

if __name__ == "__main__":
    # Node.js se argument lena
    form_no = sys.argv[1] if len(sys.argv) > 1 else None
    if form_no:
        asyncio.run(download_jnvu_pdf(form_no))
