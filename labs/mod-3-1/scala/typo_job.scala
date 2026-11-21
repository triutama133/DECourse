import spark.implicits._
val df = Seq((1L, "paid", 150000L)).toDF("orderId", "status", "totalIdr")
df.select($"total_idr").show()
System.exit(0)
