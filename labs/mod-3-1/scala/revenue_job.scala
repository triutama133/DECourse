import org.apache.spark.sql.functions._
import spark.implicits._

case class Order(orderId: Long, customerId: Long, status: String, totalIdr: Long)

val orders = Seq(
  Order(1, 10, "paid", 150000), Order(2, 10, "cancelled", 90000),
  Order(3, 11, "paid", 200000), Order(4, 12, "shipped", 120000),
  Order(5, 11, "paid", 50000)
).toDS()

val revenue = orders
  .filter($"status" =!= "cancelled")
  .groupBy($"customerId")
  .agg(sum($"totalIdr").as("revenueIdr"), count(lit(1)).as("orders"))
  .orderBy($"revenueIdr".desc)

revenue.show()
val big = orders.filter($"totalIdr" >= 100000).select($"orderId").as[Long].collect().sorted
println("big orders: " + big.mkString(","))
System.exit(0)
