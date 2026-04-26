import { Navigate, useParams } from "react-router-dom";

const SellFromStock = () => {
  const { id } = useParams();

  if (!id) {
    return <Navigate to="/stock" replace />;
  }

  return <Navigate to={`/sale/add?stockId=${id}`} replace />;
};

export default SellFromStock;
