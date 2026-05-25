const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const { pool } = require("../config/db");
const { hashPassword } = require("../utils/password");

async function insertIfEmpty(tableName, handler) {
  const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM ${tableName}`);
  if ((rows[0]?.total || 0) === 0) {
    await handler();
  }
}

async function seedAdmin() {
  const adminPassword = await hashPassword("admin123456");

  await insertIfEmpty("admin", async () => {
    await pool.execute(
      "INSERT INTO admin (username, password, real_name, phone, status) VALUES (?, ?, ?, ?, ?)",
      ["admin", adminPassword, "系统管理员", "18800000000", 1]
    );
  });
}

async function seedUsers() {
  const userPassword = await hashPassword("user123456");

  await insertIfEmpty("`user`", async () => {
    await pool.execute(
      `
        INSERT INTO \`user\` (openid, student_id, nickname, avatar, phone, password, status)
        VALUES
        (?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        "mock_openid_u1001",
        "20230001",
        "王同学",
        "",
        "13900000001",
        userPassword,
        1,
        "mock_openid_u1002",
        "20230002",
        "赵同学",
        "",
        "13900000002",
        userPassword,
        1,
        "mock_openid_u1003",
        "20230003",
        "陈同学",
        "",
        "13900000003",
        userPassword,
        1
      ]
    );
  });
}

async function seedIdleGoods(users) {
  await insertIfEmpty("idle_goods", async () => {
    await pool.execute(
      `
        INSERT INTO idle_goods
        (user_id, title, price, description, images, contact_info, status, reject_reason, browse_count)
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        users[0].user_id,
        "九成新台灯",
        35,
        "可正常使用，支持当面验货。",
        "",
        "微信:light001",
        1,
        "",
        12,
        users[1].user_id,
        "二手考研资料",
        60,
        "包含数学和英语资料。",
        "",
        "电话:13900000002",
        2,
        "封面信息不完整，请补充更清晰的商品图。",
        5,
        users[2].user_id,
        "宿舍折叠桌",
        45,
        "桌面有轻微划痕，适合自提。",
        "",
        "微信:desk003",
        3,
        "重复发布，已下架。",
        9,
        users[0].user_id,
        "便携小风扇",
        18,
        "刚买不久，准备换新款。",
        "",
        "微信:fan001",
        0,
        "",
        1
      ]
    );
  });
}

async function seedErrandOrders(users) {
  await insertIfEmpty("errand_order", async () => {
    await pool.execute(
      `
        INSERT INTO errand_order
        (publisher_id, receiver_id, title, description, pick_address, pick_latitude, pick_longitude, deliver_address, deliver_latitude, deliver_longitude, reward, images, contact_info, expect_time, status, reject_reason, finish_time)
        VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        users[0].user_id,
        null,
        "帮取快递",
        "菜鸟驿站取一个中号包裹。",
        "菜鸟驿站",
        39.90923,
        116.397428,
        "3号宿舍楼 412",
        39.915378,
        116.401394,
        4.5,
        "",
        "13900000001",
        "今晚八点前",
        1,
        "",
        null,
        users[1].user_id,
        null,
        "校门口代拿外卖",
        "晚上 8 点前送达。",
        "东门外卖柜",
        39.90923,
        116.397428,
        "6号宿舍楼 105",
        39.915378,
        116.401394,
        6,
        "",
        "13900000002",
        "晚上 8 点前送达",
        6,
        "联系方式缺失，请补充完整后重新提交。",
        null,
        users[2].user_id,
        null,
        "图书馆代取打印件",
        "中午前送到教学楼。",
        "图书馆服务台",
        39.91011,
        116.399991,
        "教学楼 B302",
        39.911212,
        116.402312,
        5,
        "",
        "13900000003",
        "中午前送到教学楼",
        7,
        "存在站外引流信息，已下架。",
        null,
        users[1].user_id,
        users[2].user_id,
        "宿舍楼下代拿水果",
        "已沟通好，尽快送到宿舍。",
        "南门水果店",
        39.908888,
        116.396666,
        "8号宿舍楼 220",
        39.913579,
        116.401111,
        3.5,
        "",
        "13900000002",
        "尽快送到宿舍楼下",
        4,
        "",
        new Date()
      ]
    );
  });
}

async function seedAuditLogs(adminId) {
  await insertIfEmpty("audit_log", async () => {
    const [idleGoods] = await pool.query(
      "SELECT goods_id, title FROM idle_goods WHERE title IN (?, ?, ?)",
      ["九成新台灯", "二手考研资料", "宿舍折叠桌"]
    );
    const [errandOrders] = await pool.query(
      "SELECT order_id, title FROM errand_order WHERE title IN (?, ?, ?)",
      ["帮取快递", "校门口代拿外卖", "图书馆代取打印件"]
    );

    const idleByTitle = new Map(idleGoods.map((item) => [item.title, item.goods_id]));
    const errandByTitle = new Map(errandOrders.map((item) => [item.title, item.order_id]));

    await pool.execute(
      `
        INSERT INTO audit_log (admin_id, business_type, business_id, audit_result, audit_reason)
        VALUES
        (?, 'idle', ?, 1, ?),
        (?, 'idle', ?, 2, ?),
        (?, 'idle', ?, 3, ?),
        (?, 'errand', ?, 1, ?),
        (?, 'errand', ?, 2, ?),
        (?, 'errand', ?, 3, ?)
      `,
      [
        adminId,
        idleByTitle.get("九成新台灯"),
        "内容合规，已通过审核",
        adminId,
        idleByTitle.get("二手考研资料"),
        "封面信息不完整，请补充更清晰的商品图。",
        adminId,
        idleByTitle.get("宿舍折叠桌"),
        "重复发布，已下架。",
        adminId,
        errandByTitle.get("帮取快递"),
        "信息完整，已通过审核",
        adminId,
        errandByTitle.get("校门口代拿外卖"),
        "联系方式缺失，请补充完整后重新提交。",
        adminId,
        errandByTitle.get("图书馆代取打印件"),
        "存在站外引流信息，已下架。"
      ]
    );
  });
}

async function seedChatMessages(users) {
  await insertIfEmpty("chat_message", async () => {
    const [idleGoods] = await pool.query(
      "SELECT goods_id FROM idle_goods WHERE title = ? LIMIT 1",
      ["九成新台灯"]
    );
    const [errandOrders] = await pool.query(
      "SELECT order_id FROM errand_order WHERE title = ? LIMIT 1",
      ["宿舍楼下代拿水果"]
    );
    const idleGoodsId = idleGoods[0]?.goods_id || 0;
    const errandOrderId = errandOrders[0]?.order_id || 0;

    await pool.execute(
      `
        INSERT INTO chat_message
        (sender_id, sender_type, receiver_id, receiver_type, content, message_type, is_read, related_type, related_id)
        VALUES
        (?, 1, ?, 1, ?, 1, 1, 'idle', ?),
        (?, 1, ?, 1, ?, 1, 0, 'idle', ?),
        (?, 1, ?, 1, ?, 1, 1, 'errand', ?),
        (?, 1, ?, 1, ?, 1, 0, 'errand', ?)
      `,
      [
        users[1].user_id,
        users[0].user_id,
        "台灯还在吗？可以小刀吗？",
        idleGoodsId,
        users[0].user_id,
        users[1].user_id,
        "还在，可以到宿舍楼下看货。",
        idleGoodsId,
        users[1].user_id,
        users[2].user_id,
        "我已经到水果店门口了。",
        errandOrderId,
        users[2].user_id,
        users[1].user_id,
        "好的，我在宿舍楼下等你。",
        errandOrderId
      ]
    );
  });
}

async function seed() {
  await seedAdmin();
  await seedUsers();

  const [admins] = await pool.query("SELECT admin_id FROM admin ORDER BY admin_id ASC LIMIT 1");
  const [users] = await pool.query("SELECT user_id FROM `user` ORDER BY user_id ASC LIMIT 3");

  if (users.length >= 3) {
    await seedIdleGoods(users);
    await seedErrandOrders(users);
    await seedChatMessages(users);
  }

  if (admins.length >= 1) {
    await seedAuditLogs(admins[0].admin_id);
  }

  await pool.end();
  console.log("Seed completed.");
}

seed().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
