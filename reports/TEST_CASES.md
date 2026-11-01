# Test cases

| ID | Test | Vulnerable expected | Secure expected | Tool |
|---|---|---|---|---|
| TC-01 | SQLi trên `q` | SQLMap/Burp xác nhận input ảnh hưởng SQL | Không injectable | SQLMap + Burp |
| TC-02 | `sv001` yêu cầu `/students/2` | HTTP 200 + dữ liệu SV2 | HTTP 403 | Burp |
| TC-03 | Login sai lặp lại | Không lock + thông báo phân biệt | Lock tạm sau 5 lần + lỗi chung | Burp |
| TC-04 | Lưu nội dung HTML/JS vào note | Nội dung được render raw | Nội dung hiển thị như text | Burp + ZAP |
| TC-05 | Quét HTTP headers/config | Cảnh báo cấu hình | Giảm/không còn finding tương ứng | ZAP + Burp |
