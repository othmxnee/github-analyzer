import plotly.express as px
import pandas as pd

data = dict(
    category=["Products", "Products", "Products", "Services", "Services"],
    item=["Phones", "Laptops", "Tablets", "Cloud", "Support"],
    value=[40, 30, 10, 15, 5]
)

df = pd.DataFrame(data)

fig = px.treemap(
    df,
    path=["category", "item"],
    values="value",
    title="Company Revenue Treemap"
)

fig.show()