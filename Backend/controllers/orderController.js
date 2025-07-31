import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';

export const confirmOrder = async (req, res) => {
  try {
    console.log("REQ.BODY:", req.body);
    const { cart } = req.body;
    const items = cart;
    const userId = req.user._id;

    const updates = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ message: `Product ${item.productId} not found` });

      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `${product.name} is out of stock.` });
      }

      product.stock -= item.quantity;
      updates.push(product.save());
    }

    await Promise.all(updates);

    const order = await Order.create({
      user: userId,
      items: items.map(i => ({ product: i.productId, quantity: i.quantity })),
      status: 'Confirmed',
      estimatedDelivery: new Date(Date.now() + Math.floor(Math.random() * 4 + 2) * 24 * 60 * 60 * 1000) // 2–5 days
    });


    res.status(201).json({ success: true, message: "Order confirmed", order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product', 'name price image') // Get product info
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
//Cancel Order
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("items.product");

    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "Cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    // Restore stock
    if (["Pending", "Confirmed"].includes(order.status)) {
      for (const item of order.items) {
        const product = await Product.findById(item.product._id);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }
    }

    order.status = "Cancelled";
    await order.save();

    res.json({ message: "Order cancelled and stock restored." });
  } catch (err) {
    console.error("Cancel order error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
 