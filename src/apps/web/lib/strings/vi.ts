// Toàn bộ chuỗi giao diện tiếng Việt gom ở đây (non-functional §3).
export const vi = {
  nav: {
    label: 'Điều hướng chính',
    today: 'Hôm nay',
    path: 'Lộ trình',
    review: 'Ôn tập',
    dictionary: 'Tra từ',
    profile: 'Tôi',
    pinyin: 'Bảng pinyin',
    sources: 'Nguồn dữ liệu',
    home: 'Trang chủ',
  },
  sources: {
    title: 'Nguồn dữ liệu',
    backToProfile: 'Về trang Tôi',
    lead: 'Website phi lợi nhuận, xây dựng trên các dữ liệu mở sau. Cảm ơn các tác giả đã chia sẻ.',
    sourcePage: 'Trang nguồn',
    licenseText: 'Văn bản giấy phép',
    ours: 'Dữ liệu của chúng tôi',
    oursBody:
      'Nội dung lộ trình và dữ liệu đã chỉnh sửa từ CC-CEDICT (phân chủ đề, câu mẫu, nghĩa rút gọn…) được chia sẻ lại theo CC BY-SA 4.0.',
    download: 'Tải về (GitHub)',
    downloadSoon: 'Liên kết tải về chưa được công bố cùng kho mã nguồn.',
    aiSome: (n: number) =>
      `Một số âm Hán Việt do AI bổ sung (${n} chữ). Bạn có thể báo lỗi ở từng trang chữ.`,
    aiNone: 'Hiện chưa có âm Hán Việt nào do AI bổ sung.',
    aiUnknown: 'Lưu ý: một số âm Hán Việt có thể do AI bổ sung.',
    codeLicenses:
      'Mã nguồn web và pipeline: MIT · dịch vụ chấm phát âm: GPL-3.0 · nội dung: CC BY-SA 4.0.',
  },
  report: {
    title: 'Báo lỗi nội dung',
    open: 'Báo lỗi',
    close: 'Đóng',
    kind: 'Loại lỗi',
    kinds: {
      pinyin: 'Sai pinyin',
      meaning: 'Sai nghĩa',
      hanviet: 'Sai Hán Việt',
      audio: 'Sai audio',
      sentence: 'Câu ví dụ không tự nhiên',
      grading: 'Chấm sai',
      other: 'Khác',
    },
    description: 'Mô tả (không bắt buộc)',
    placeholder: 'Bạn thấy sai ở đâu?',
    submit: 'Gửi báo lỗi',
    thanks: 'Cảm ơn bạn, mình đã ghi nhận báo lỗi.',
    tooMany: 'Bạn đã gửi quá nhiều báo lỗi hôm nay. Hãy thử lại vào ngày mai.',
    failed: 'Chưa gửi được báo lỗi, hãy thử lại.',
  },
  footer: {
    sourcesAndLicenses: 'Nguồn dữ liệu và giấy phép',
    credits: (list: string[]) => `Nguồn: ${list.join(' · ')} · `,
  },
} as const;
